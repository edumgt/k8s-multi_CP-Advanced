## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API LB(`192.168.56.31:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# jupyter-pod-router

Jupyter named pod로 요청을 프록시하는 경량 Node.js 라우터입니다.

## 목표
- ingress DNS 없이 `http://192.168.56.240/jupyter/lab` 형태의 보호된 path 기반 접속 지원
- 필요 시 `hosts` 파일 기반 `.local` 별칭 host 라우팅도 함께 지원
- headless service DNS를 사용해 사용자별 Jupyter pod로 내부 프록시

## 환경 변수
- `PORT` 기본값 `8080`
- `ROUTER_PATH_PREFIX` 기본값 `/jupyter`
- `ROUTER_HOST_SUFFIX` 기본값 빈 값
- `ROUTER_HEADLESS_SERVICE` 기본값 `jupyter-named-pod`
- `ROUTER_TARGET_NAMESPACE` 기본값 `dis`
- `ROUTER_TARGET_PORT` 기본값 `8888`
