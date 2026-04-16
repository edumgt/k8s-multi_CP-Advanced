## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API Server(예: `192.168.56.10:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# fss-dataxflow-airflow

ELT(`fss-dataxflow`) 워크로드를 위한 Airflow 이미지 소스입니다.

- 이미지 목적: dataxflow 배치 스케줄링/오케스트레이션
- 이미지 경로(권장): `ghcr.io/k8s-fss/fss-dataxflow-airflow:latest`
- 주요 구성:
  - `Dockerfile`
  - `requirements.txt`
  - `dags/`

호환 경로로 `apps/airflow -> apps/fss-dataxflow-airflow` 심볼릭 링크를 유지합니다.
