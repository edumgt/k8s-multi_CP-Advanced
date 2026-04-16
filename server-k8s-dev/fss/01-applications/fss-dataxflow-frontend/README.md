## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API Server(예: `192.168.56.10:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# fss-dataxflow-frontend

`dataxflow.fss.or.kr`용 Vue3 + Quasar SPA 프론트엔드입니다.

## 배포 대상
- Registry image: `ghcr.io/k8s-fss/fss-dataxflow-frontend`
- Kubernetes deployment: `fss-dataxflow-frontend` (별도 ELT 매니페스트에서 참조)

## 환경 파일
- `.env.dev` 기본 API: `http://api.dataxflow.fss.or.kr`
- `.env.prod` 기본 API: `http://api.dataxflow.fss.or.kr`
