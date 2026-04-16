# k8s-fss VMware 환경 운영 가이드

## 환경 개요

| 구분 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware | 전체 인프라는 VMware VM 기반 |
| Control Plane | `192.168.56.10` | Kubernetes API Server 진입점 (`:6443`) |
| Worker Nodes | `192.168.56.11~13` | Kubernetes 워커 노드 대역 |
| 일반 VM | `192.168.56.20`, `192.168.56.31~35` | NFS, 배치, 유틸리티 등 일반 워크로드 용도 |
| MetalLB VIP | `192.168.56.240` | `LoadBalancer` Service 외부 노출 IP |
| 기본 사용자 | `ubuntu` | VM 접속 계정 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 본 저장소 루트 |

## Kubernetes 접근 표준

| 항목 | 값 | 설명 |
|---|---|---|
| kubeconfig 소스 | CP의 `/etc/kubernetes/admin.conf` | 인증/권한 문제 없이 운영 가능한 표준 설정 |
| kubectl 서버 주소 | `https://192.168.56.10:6443` | WSL/운영자 PC에서 접근 시 고정 |
| 현재 확인 명령 | `kubectl get nodes -o wide` | 노드 상태 및 런타임 확인 |
| 현재 확인 명령 | `kubectl get pods -A` | 전체 네임스페이스 파드 상태 확인 |

## 네트워크/서비스 노출

| 항목 | 값 | 설명 |
|---|---|---|
| CNI | Calico | Pod 네트워킹 및 라우팅 |
| Ingress | ingress-nginx | HTTP/HTTPS 진입점 컨트롤러 |
| L4 LB | MetalLB (L2) | Bare Metal/VMware 환경의 `LoadBalancer` 구현 |
| 공인 엔드포인트(내부망 기준) | `192.168.56.240` | ingress-nginx-controller `EXTERNAL-IP` |
| DNS 연결 권장 | `서비스 도메인 -> 192.168.56.240` | 도메인 기반 서비스 접근 표준 |

## 스토리지 구성

| 항목 | 값 | 설명 |
|---|---|---|
| NFS 서버 | `192.168.56.20:/nfs` | PV/PVC의 RW 스토리지 백엔드 |
| POC 위치 | `server-k8s-dev/fss/storage/rook-ceph-over-nfs` | NFS 마운트/쓰기 검증 스크립트 포함 |
| 인프라 데이터 | MongoDB/Redis PVC | `infra` 네임스페이스 상태성 데이터 저장 |

## 애플리케이션 구성

| 영역 | 컴포넌트 | 기술 스택 |
|---|---|---|
| DIS Backend | `fss-dis-server-node` | Node.js 22, Express 5, Socket.io, Mongoose, Redis Session, `@kubernetes/client-node` |
| DIS Frontend | `fss-dis-frontend` | Vue 3, Quasar, Vite |
| Jupyter Router | `jupyter-pod-router` | Node.js 기반 wildcard host -> named pod 프록시 |
| DataXFlow Backend | `fss-dataxflow-backend` | Python/FastAPI 계열 API + JWT 인증 연동(문서 기준) |
| DataXFlow Frontend | `fss-dataxflow-frontend` | Vue 3, Quasar |
| Airflow | `fss-dataxflow-airflow` | Apache Airflow, DAG 기반 ELT 오케스트레이션 |

## 운영 네임스페이스

| Namespace | 용도 | 주요 리소스 |
|---|---|---|
| `app` | 애플리케이션 | DIS/DataXFlow 앱 배포 |
| `dis` | 사용자 Jupyter/서비스 | named pod, 라우터, 서비스 |
| `infra` | 공통 인프라 | MongoDB, Redis |
| `sample` | 테스트/POC | NFS 검증 및 샘플 워크로드 |
| `unitest` | 단위 테스트성 리소스 | 검증용 임시 리소스 |

## 배포 기본 명령

| 환경 | 명령 | 설명 |
|---|---|---|
| Dev | `kubectl apply -k 02-infrastructure/k8s/fss/overlays/dev` | 개발 오버레이 배포 |
| Prod | `kubectl apply -k 02-infrastructure/k8s/fss/overlays/prod` | 운영 오버레이 배포 |
| 상태 점검 | `kubectl get all -A` | 전체 오브젝트 상태 점검 |
| Ingress 확인 | `kubectl -n ingress-nginx get svc` | `EXTERNAL-IP=192.168.56.240` 확인 |

## 문서 인덱스

| 문서 | 경로 | 설명 |
|---|---|---|
| K8s 설치/운영 로그 | `server-k8s-dev/docs/20260413.md` | 설치 과정 및 운영 기록(과거 로그 포함) |
| FSS 통합 매니페스트 | `server-k8s-dev/fss/README.md` | FSS Blueprint와 적용 가이드 |
| 인프라 오버레이 | `02-infrastructure/k8s/fss/README.md` | Kustomize 인프라/앱 배포 기준 |
| NFS POC | `server-k8s-dev/fss/storage/rook-ceph-over-nfs/README.md` | NFS 기반 스토리지 검증 절차 |

## 운영 참고

| 항목 | 권장 사항 | 이유 |
|---|---|---|
| kubeconfig | BasicAuth 대신 `admin.conf`/서비스 계정 토큰 사용 | 최신 K8s에서 BasicAuth 비활성화가 일반적 |
| LoadBalancer IP | `192.168.56.240` 단일 표준 사용 | 운영/문서/모니터링의 기준점 일치 |
| 문서 관리 | 과거 로그와 운영 기준 문서 분리 | 재현성과 현재 운영 정합성 확보 |

## Headlamp 접속 토큰 (100일)

| 항목 | 값 | 설명 |
|---|---|---|
| ServiceAccount | `app/headlamp-admin` | Headlamp 로그인용 토큰 발급 대상 |
| 발급 명령 | `kubectl -n app create token headlamp-admin --duration=2400h` | 100일(2400시간) 유효 토큰 생성 |
| 만료 시각(UTC) | `2026-07-25 07:52:24 UTC` | 발급 시점 기준 100일 |

```text
eyJhbGciOiJSUzI1NiIsImtpZCI6IlVpd2pobTJJYm5jdWFSWE9SQlJTMy1DbHhtZE5mNGlZRXU5QVptSmNYN2MifQ.eyJhdWQiOlsiaHR0cHM6Ly9rdWJlcm5ldGVzLmRlZmF1bHQuc3ZjLmNsdXN0ZXIubG9jYWwiXSwiZXhwIjoxNzg0OTY1OTQ0LCJpYXQiOjE3NzYzMjU5NDQsImlzcyI6Imh0dHBzOi8va3ViZXJuZXRlcy5kZWZhdWx0LnN2Yy5jbHVzdGVyLmxvY2FsIiwianRpIjoiZjljN2VlMDgtNjc2MC00YzNkLWJiOGUtNTRjZTNkZjQ5YmEyIiwia3ViZXJuZXRlcy5pbyI6eyJuYW1lc3BhY2UiOiJhcHAiLCJzZXJ2aWNlYWNjb3VudCI6eyJuYW1lIjoiaGVhZGxhbXAtYWRtaW4iLCJ1aWQiOiIxYjlhODYwZC1mOTE2LTQxZDItOTZhOC1hOThiYWYyMjc1ZmQifX0sIm5iZiI6MTc3NjMyNTk0NCwic3ViIjoic3lzdGVtOnNlcnZpY2VhY2NvdW50OmFwcDpoZWFkbGFtcC1hZG1pbiJ9.yCsITUW1PcaA1BCFmNV9mtao6LeqsUd5IBl3Un64TvU3yY-yKU3aWdqUsKHKOM_maip5M_VzhHmt2jZudOpRbkEkFEqTY4DyXsVKWHbyvKXKppTOe3WpFs5q-BmFrDBLeXpqvHPRcWh64-o1MFtj4cXzDWJc7HxZ4UbDx-s7plsN2uP4ZEykB_jxYf9MSKBM615qv_g0ytj3KKQKhAuNLgGHRFToUC2SBz_LH2DyM28F5mqmKMOefXAMb5qnE0EoMLbxdANpueUVNz8iFCflIu1Yn4QFZ860QZa_8phpGth7o--heakdQaZVi9nojD5iEf-yxVIXknHATW8kYyNZ7w
```
