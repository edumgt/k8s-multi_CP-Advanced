# 192.168.56.32

| 항목 | 값 |
|---|---|
| 서버종류 | Harbor Container Registry 서버 |
| OS | Ubuntu 24.04.4 LTS |
| 호스트명 | `harbor-32` |
| 관리 접속 | `ssh ubuntu@192.168.56.32` |
| SSH 계정 | `ubuntu / ubuntu` |
| Harbor 버전(컨테이너 이미지 기준) | `v2.15.0` |
| Harbor 외부 엔드포인트(설정값) | `https://192.168.56.32` |
| 웹 UI 예상 URL | `https://192.168.56.32` |
| Harbor 관리자 계정 | `admin / Harbor12345!` |

## 현재 상태 (점검일: 2026-04-17, 재점검 반영)

- Harbor 관련 컨테이너(`nginx`, `harbor-core`, `registry`, `harbor-db` 등)가 모두 `Exited` 상태
- 80/443 포트 리스닝 없음
- 웹 UI 접속 확인 결과:
  - `curl -k -I https://192.168.56.32` -> 연결 실패
  - `curl -I http://192.168.56.32` -> 연결 실패
- Harbor는 `https://192.168.56.32`로 직접 사용
- `https://192.168.56.32` 접속 실패 상태

## Harbor 구성 메모

- `nginx` 컨테이너 포트 매핑: `Host 80 -> Container 8080`, `Host 443 -> Container 8443`
- `registry` 데이터 경로: `/data/registry` (컨테이너 `/storage` 바인드)
- Harbor core 환경변수에서 확인된 설정:
  - `EXT_ENDPOINT=https://192.168.56.32`
  - `REGISTRY_URL=http://registry:5000`

## 현재 이미지 목록 (서버 로컬 Docker 이미지 기준)

Harbor API 조회는 현재 서비스 중단으로 불가하여, `docker images` 기준으로 확인한 목록입니다.

| Repository | Tag |
|---|---|
| `192.168.56.32/data-platform/platform-ingress-nginx-controller` | `v1.14.1` |
| `192.168.56.32/data-platform/platform-coredns` | `v1.13.1` |
| `192.168.56.32/data-platform/platform-etcd` | `3.6.6-0` |
| `192.168.56.32/data-platform/platform-kube-apiserver` | `v1.35.3` |
| `192.168.56.32/data-platform/platform-kube-controller-manager` | `v1.35.3` |
| `192.168.56.32/data-platform/platform-kube-proxy` | `v1.35.3` |
| `192.168.56.32/data-platform/platform-kube-scheduler` | `v1.35.3` |
| `192.168.56.32/data-platform/k8s-data-platform-frontend` | `latest`, `20260409-gnb1`, `20260409-openlabtabfix1`, `20260409-platformoffcanvasfix2`, `20260409-platformnosql1`, `20260409-openlabfix1` |
| `192.168.56.32/data-platform/k8s-data-platform-backend` | `20260409-platformnosql1`, `20260409-dataxnojupyter1`, `20260409-dataxfix3`, `20260409-dataxfix`, `dynamic-default-20260406-bootstrapfix`, `dynamic-default-20260406` |
| `192.168.56.32/data-platform/k8s-dataxflow-frontend` | `20260409-menufix` |
| `192.168.56.32/app/fss-adw-server-node` | `latest` |
| `192.168.56.32/app/fss-adw-frontend` | `latest` |
| `192.168.56.32/library/jupyter-pod-router` | `latest` |
| `192.168.56.32/library/mongo` | `8.2.5` |
| `192.168.56.32/library/redis` | `8.6.1` |
| `192.168.56.32/data-platform/platform-redis` | `7-alpine` |
| `192.168.56.32/data-platform/platform-calico-node` | `v3.31.2` |
| `192.168.56.32/data-platform/platform-calico-kube-controllers` | `v3.31.2` |
| `192.168.56.32/data-platform/platform-calico-cni` | `v3.31.2` |
| `192.168.56.32/data-platform/platform-kubernetes-dashboard` | `v2.7.0` |
| `192.168.56.32/data-platform/platform-kubernetes-dashboard-metrics-scraper` | `v1.0.8` |

## 참고

- 현재 Harbor 서비스가 내려가 있어 웹 UI/API 기반의 실시간 프로젝트/리포지토리 조회는 불가
- air-gap 미러 준비용으로 일부 Kubernetes core 이미지를 `192.168.56.32/data-platform/*` 태그로 로컬에 선적재해 둔 상태
- Harbor를 기동한 뒤에는 `api/v2.0/projects`, `api/v2.0/repositories` API로 최신 목록 재확인 권장
