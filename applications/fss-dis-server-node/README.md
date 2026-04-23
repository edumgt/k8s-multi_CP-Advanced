## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API LB(예: `192.168.56.31:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# fss-dis-server-node

Node 22 + Express 5 기반의 Jupyter 거버넌스 API 서버입니다.

## 목표
- Python 기반 Jupyter 관리 API를 Node.js 기반으로 전환
- 사용자별 리소스 신청/승인 워크플로우 제공
- 승인된 사용자에 대해 PVC 생성 + named Pod 생성
- ingress path(`http://192.168.56.240/jupyter/lab`) 또는 `hosts` 기반 `platform.local`로 개인 JupyterLab 연결

## 기술 스택
- Backend: Node 22, Express 5, Socket.io, Mongoose, Redis session
- K8s client: `@kubernetes/client-node`

## 환경 변수
기본 샘플은 `.env.example` 참고.

WSL에서 백엔드를 직접 띄울 때는 `wsl.env.example` 값을 기준으로 `MONGO_URI=localhost`, `REDIS_URL=localhost`, `FRONTEND_URL=http://localhost:31320`로 맞추고, Jupyter 공개 경로는 `JUPYTER_PUBLIC_BASE_URL`로 별도 지정한다.

기본 로그인 계정:
- 사용자: `test-user / test-password`
- 관리자: `admin@test.com / 123456`

핵심 변수:
- `MONGO_URI`, `REDIS_URL`
- `K8S_USER_NAMESPACE` (사용자 Pod/PVC namespace, 기본 `dis`)
- `LAB_GOVERNANCE_ENABLED`
- `JUPYTER_IMAGE`
- `JUPYTER_ACCESS_MODE` (`ingress-path` 권장)
- `JUPYTER_DYNAMIC_HOST_SUFFIX`, `JUPYTER_DYNAMIC_SCHEME`, `JUPYTER_DYNAMIC_SUBDOMAIN`
- `JUPYTER_PUBLIC_BASE_URL` (WSL 개발 시 Jupyter를 열 공개 ingress 주소)
- `JUPYTER_PERSONAL_PVC_NAME`, `JUPYTER_PERSONAL_MOUNT_PATH`
  - 설정 시 사용자 Jupyter Pod 안에 NAS PVC를 `/personal` 같은 경로로 추가 마운트
  - PVC는 반드시 사용자 Pod와 같은 namespace에 존재해야 함

## 주요 API
- 인증
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- 사용자/관리
  - `GET /api/demo-users`
  - `GET /api/admin/users`
  - `POST /api/admin/users`
- 거버넌스
  - `POST /api/resource-requests`
  - `GET /api/resource-requests/me`
  - `GET /api/admin/resource-requests`
  - `POST /api/admin/resource-requests/{request_id}/review`
  - `POST /api/environment-requests`
  - `GET /api/environment-requests/me`
  - `GET /api/admin/environment-requests`
  - `POST /api/admin/environment-requests/{request_id}/review`
  - `GET /api/admin/analysis-environments`
  - `POST /api/admin/analysis-environments`
- Jupyter 세션
  - `POST /api/jupyter/sessions`
  - `GET /api/jupyter/sessions/{username}`
  - `DELETE /api/jupyter/sessions/{username}`
  - `GET /api/jupyter/connect/{username}`
- 운영
  - `GET /api/admin/sandboxes`
  - `GET /api/control-plane/dashboard`

## 상태
- 현재 1차 마이그레이션 버전입니다.
- Harbor snapshot publish (`/api/jupyter/snapshots`)는 요청 수신/상태 응답만 제공하고 실제 publish job은 미구현입니다.
