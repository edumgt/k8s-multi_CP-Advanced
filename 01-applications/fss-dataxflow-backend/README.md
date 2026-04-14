# fss-dataxflow-backend

이 디렉터리는 GitLab 의 개별 app repo 로 push 하는 스캐폴드입니다.

## CI/CD 흐름

- GitLab Runner 가 pipeline 을 실행
- Kaniko 로 공인 registry 이미지 빌드/푸시
- `kubectl set image` 로 Kubernetes deployment `backend` 갱신

## 필요한 GitLab CI 변수

- `HARBOR_USERNAME`
- `HARBOR_PASSWORD`
- `NEXUS_PYPI_INDEX_URL` (backend)
- `NEXUS_PYPI_TRUSTED_HOST` (backend)
- `NEXUS_NPM_REGISTRY` (frontend)
- `NEXUS_NPM_AUTH_B64` (frontend, optional)

브랜치는 `dev` 또는 `prod`를 사용하면 환경별 namespace/dev-proxy URL이 자동으로 적용됩니다.

## 배포 대상

- Registry image: `ghcr.io/k8s-fss/fss-dataxflow-backend`
- Kubernetes deployment: `backend`

## JWT 로그인 연동 (프론트 모달)

- 로그인 API: `POST /api/auth/login`
- 요청 본문(JSON): `{"username":"test1@test.com","password":"123456"}`
- 응답: `access_token`, `token_type`(`bearer`), `expires_in`, `user` (기존 `token` 필드도 호환 유지)
- 인증 헤더: `Authorization: Bearer <access_token>` (기존 `x-auth-token`도 호환 유지)

예시:

```bash
API_BASE_URL="http://api.dataxflow.fss.or.kr"

curl -sS "${API_BASE_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"test1@test.com","password":"123456"}'
```

```bash
curl -sS "${API_BASE_URL}/api/auth/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

환경변수(선택):

- `PLATFORM_AUTH_JWT_SECRET` (기본: `platform-auth-jwt`)
- `PLATFORM_AUTH_JWT_ALGORITHM` (기본: `HS256`)
- `PLATFORM_AUTH_JWT_TTL_SECONDS` (기본: `43200`, 12시간)
- `PLATFORM_CORS_ALLOW_ORIGINS` (콤마 구분 오리진 목록)
- `PLATFORM_CORS_ALLOW_ORIGIN_REGEX` (오리진 정규식)
- `PLATFORM_CORS_ALLOW_CREDENTIALS` (`true`/`false`)

## Teradata Bootstrap (관리자 전용)

Teradata 는 오픈소스 내장 DB가 아니라 외부 상용 DB 연결 방식입니다.
이 백엔드는 관리자 API로 bootstrap SQL(엔진성 SP + 메타/공통코드/계정 seed)을 실행할 수 있습니다.

- Endpoint: `POST /api/admin/teradata/bootstrap`
- 권한: admin JWT 필요 (`Authorization: Bearer <token>`)
- 기본 동작: `dry_run=true` 권장
- 기본 SQL 파일: `app/sql/teradata/bootstrap.sql`
- 구분자: SQL 파일에서 `--@@` 로 statement block 분리

필수 환경변수:

- `PLATFORM_TERADATA_FAKE_MODE=false`
- `PLATFORM_TERADATA_DBMS=teradata` (기본) 또는 `postgres` (mock DB)
- `PLATFORM_TERADATA_HOST`
- `PLATFORM_TERADATA_PORT` (선택, PostgreSQL mock 시 보통 `5432`)
- `PLATFORM_TERADATA_USER`
- `PLATFORM_TERADATA_PASSWORD`
- `PLATFORM_TERADATA_DATABASE`
- (선택) `PLATFORM_TERADATA_BOOTSTRAP_SQL_PATH` (커스텀 SQL 파일 경로)

예시:

```bash
# 1) admin 로그인
API_BASE_URL="http://api.dataxflow.fss.or.kr"
TOKEN=$(curl -sS "${API_BASE_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@test.com","password":"123456"}' | jq -r '.access_token')

# 2) dry-run (권장)
curl -sS "${API_BASE_URL}/api/admin/teradata/bootstrap" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"dry_run":true}'

# 3) 실제 실행
curl -sS "${API_BASE_URL}/api/admin/teradata/bootstrap" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"dry_run":false}'
```

### PostgreSQL Mock DB로 테스트하기

Teradata 라이선스/망 제약으로 즉시 검증이 어려우면 PostgreSQL mock 모드로 흐름 테스트가 가능합니다.

1. Mock DB 배포:

```bash
kubectl -n app apply -f infra/k8s/addons/teradata-mock-postgres.yaml
```

2. backend 환경값 설정(예시):

```bash
kubectl -n app patch configmap platform-config --type merge -p '{
  "data": {
    "PLATFORM_TERADATA_DBMS": "postgres",
    "PLATFORM_TERADATA_PORT": "5432",
    "PLATFORM_TERADATA_DATABASE": "teradata_mock",
    "PLATFORM_TERADATA_FAKE_MODE": "false"
  }
}'
```

```bash
kubectl -n app patch secret platform-secrets --type merge -p '{
  "stringData": {
    "PLATFORM_TERADATA_HOST": "teradata-mock-postgres",
    "PLATFORM_TERADATA_USER": "td_mock_user",
    "PLATFORM_TERADATA_PASSWORD": "td_mock_password"
  }
}'
```

3. backend 재시작 후 bootstrap API 실행:

```bash
kubectl -n app rollout restart deployment/backend
```

이 모드는 API/승인/스케줄링 통합 흐름 테스트용이며, Teradata 고유 SQL/SP 문법의 완전한 호환 검증을 대체하지는 않습니다.

## Governed JupyterLab (신청/승인 기반)

목표 시나리오:

- 관리자가 Harbor 이미지(분석환경)를 등록
- 사용자가 vCPU/Memory/Disk 자원 신청
- 관리자가 승인하면 사용자 전용 PVC 생성
- 사용자가 분석환경 신청
- 관리자가 승인하면 사용자는 승인된 이미지/리소스로 개인 Pod 실행

관련 설정:

- `PLATFORM_LAB_GOVERNANCE_ENABLED=true` 로 설정 시 `/api/jupyter/sessions` 가 승인 정책을 강제
- `PLATFORM_JUPYTER_USER_PVC_STORAGE_CLASS` 로 사용자 PVC StorageClass 지정 가능

주요 API:

- 사용자/관리자 계정 관리
  - `GET /api/admin/users`
  - `POST /api/admin/users`
- 분석환경(이미지) 등록
  - `GET /api/admin/analysis-environments`
  - `POST /api/admin/analysis-environments`
- 자원 신청/승인
  - `POST /api/resource-requests`
  - `GET /api/resource-requests/me`
  - `GET /api/admin/resource-requests`
  - `POST /api/admin/resource-requests/{request_id}/review`
- 분석환경 신청/승인
  - `POST /api/environment-requests`
  - `GET /api/environment-requests/me`
  - `GET /api/admin/environment-requests`
  - `POST /api/admin/environment-requests/{request_id}/review`
- 정책 확인 및 접속 URL 발급
  - `GET /api/users/me/lab-policy`
  - `GET /api/jupyter/connect/{username}` (본인 Pod 여부 검증 후 redirect URL 반환)
