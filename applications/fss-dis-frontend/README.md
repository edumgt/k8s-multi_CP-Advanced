## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API LB(예: `192.168.56.31:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# fss-dis-frontend

`192.168.56.240` 또는 `platform.local`용 Vue3 + Quasar SPA 프론트엔드입니다.

## 배포 대상
- Registry image: `192.168.56.32/app/fss-adw-frontend`
- Kubernetes deployment: `fss-dis-frontend` (`infra/k8s/fss/base/dis-app.yaml`)

## 환경 파일
- `.env.dev`/`.env.prod` 의 `VITE_API_BASE_URL` 기본값은 비워둡니다.
- 비어 있으면 브라우저 접속 host(IP/도메인)를 자동 사용하므로 MetalLB 고정 IP와 DNS 전환을 모두 지원합니다.
- WSL에서 개발 서버를 직접 띄울 때는 `wsl.env.example` 기준으로 `VITE_API_BASE_URL=http://localhost:3000/fss-dis-server` 를 사용합니다.
