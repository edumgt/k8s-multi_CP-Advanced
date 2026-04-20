# k8s-fss (VMware)

| 항목 | 값 |
|---|---|
| 하이퍼바이저 | VMware |
| Control Plane | `192.168.56.10` |
| Worker | `192.168.56.11~13` |
| General VM | `192.168.56.20`, `192.168.56.31`, `192.168.56.32`, `192.168.56.34~35` |
| MetalLB EIP | `192.168.56.240` |

## 시스템 구성도

```mermaid
flowchart TB
  U[사용자/운영자]

  subgraph VW[VMware Network 192.168.56.0/24]
    VIP[192.168.56.240\nMetalLB VIP / Ingress Entry]

    subgraph K8S[Kubernetes Cluster]
      CP[192.168.56.10\nControl Plane]
      W1[192.168.56.11\nWorker Node]
      W2[192.168.56.12\nWorker Node]
      W3[192.168.56.13\nWorker Node]
    end

    NFS[192.168.56.20\nStorage/NFS Server]

    subgraph GVM[General VM Pool]
      V31[192.168.56.31\nGeneral VM]
      V32[192.168.56.32\nGeneral VM]
      V33[192.168.56.33\nGitLab Server]
      V34[192.168.56.34\nGeneral VM]
      V35[192.168.56.35\nGeneral VM]
    end
  end

  U --> VIP
  VIP --> W1
  VIP --> W2
  VIP --> W3
  CP --> W1
  CP --> W2
  CP --> W3
  W1 --> NFS
  W2 --> NFS
  W3 --> NFS
```

## 최상위 폴더 구성

| 폴더 | 구성 내용 | 비고 |
|---|---|---|
| `applications/` | 앱 소스(backend/frontend/router/jupyter) | 빌드/이미지 생성 대상 |
| `manifests/` | Kubernetes 배포 매니페스트 원본 | dev/prod 오버레이 포함 |
| `infra/` | VM IP별 인벤토리 문서 | `server종류.md` 11개 |

## applications 구성 상세

| 경로 | 역할 | 실행/빌드 핵심 |
|---|---|---|
| `applications/fss-dis-server-node` | DIS 거버넌스 API 서버 | Node.js 22, Express 5 |
| `applications/fss-dis-frontend` | DIS 프론트엔드 | Vue 3, Quasar, Vite |
| `applications/jupyter-pod-router` | Jupyter named pod 라우터 | Node.js 22, http-proxy |
| `applications/jupyter` | 사용자 Jupyter 이미지 베이스 | JupyterLab, pandas, teradatasql |

## manifests 구성 상세

| 경로 | 역할 | 주요 파일 |
|---|---|---|
| `manifests/fss/base` | 공통 리소스 베이스 | `dis-app.yaml`, `dynamic-routing.yaml`, `mongodb.yaml`, `redis.yaml` |
| `manifests/fss/overlays/dev` | 개발 환경 오버레이 | `local-pv.yaml`, `metallb-ip-pool.yaml`, `ingress-nginx-lb.yaml` |
| `manifests/fss/overlays/prod` | 운영 환경 오버레이 | `infra-scale-patch.yaml` |
| `manifests/platform` | 클러스터 공통 플랫폼 | `calico.yaml`, `ingress-nginx.yaml`, `metallb-native.yaml`, `metrics-server.yaml` |
| `manifests/apps` | 앱 단위 개별 매니페스트 | `headlamp-app.yaml`, `headlamp-offline.yaml` |
| `manifests/addons` | 선택 애드온 | `teradata-mock-postgres.yaml` |
| `manifests/storage` | 스토리지 검증 리소스 | `rook-ceph-over-nfs/*.yaml` |
| `manifests/samples` | 샘플 워크로드 | `jupyter-samples.yaml` |

## 기술 스택

| 영역 | 스택 |
|---|---|
| Backend (DIS) | Node.js 22, Express 5, Socket.io, Mongoose, ioredis, `@kubernetes/client-node` |
| Frontend | Vue 3, Quasar, Vite, Axios, Chart.js, AG Grid |
| Router | Node.js 22, Express 5, http-proxy |
| Data/Batch | JupyterLab, pandas |
| Kubernetes | Kustomize overlays(dev/prod), Ingress-NGINX, MetalLB, Calico, Metrics Server |
| Data Services | MongoDB, Redis, NFS (`192.168.56.20`) |

## 배포 명령

| 환경 | 명령 |
|---|---|
| Dev | `kubectl apply -k manifests/fss/overlays/dev` |
| Prod | `kubectl apply -k manifests/fss/overlays/prod` |

## 주요 접속

| 서비스 | URL |
|---|---|
| Ingress VIP | `http://192.168.56.240/` |
| Headlamp | `http://192.168.56.240/headlamp-dashboard/?lng=en` |

## etcd 백업 운영

- 단일 control plane 환경이므로 `etcd` snapshot 백업을 정기적으로 수행해야 함
- 로컬 원본 스크립트: [`scripts/etcd-backup.sh`](/home/ubuntu/k8s-fss/scripts/etcd-backup.sh)
- control plane 실행 경로: `192.168.56.10` 의 `/home/ubuntu/etcd-tools/etcd-backup.sh`
- 관련 도구 위치:
  - `192.168.56.10` 의 `/home/ubuntu/etcd-tools/etcdctl`
  - `192.168.56.10` 의 `/home/ubuntu/etcd-tools/etcdutl`
- 기본 동작:
  - `https://127.0.0.1:2379` 기준 snapshot 생성
  - 실제 백업 저장 위치는 control plane 의 `/var/backups/etcd`
  - `.db.gz` 압축 백업 저장
  - `.sha256` 체크섬 생성
  - 7일 초과 백업 파일 자동 삭제
  - 호스트에 `etcdctl` 이 없으면 control plane 의 `containerd` 캐시 etcd 이미지로 fallback 실행
- 2026-04-20 기준 검증 완료:
  - CP `192.168.56.10` 에서 스크립트 직접 실행 성공
  - `/var/backups/etcd` 에 snapshot 생성 성공
  - 최신 snapshot 으로 임시 경로 restore 테스트 성공
  - live `/var/lib/etcd` 교체는 수행하지 않음

수동 실행:

```bash
ssh ubuntu@192.168.56.10
sudo /home/ubuntu/etcd-tools/etcd-backup.sh
```

보관 기간/경로 변경 예:

```bash
sudo BACKUP_DIR=/data/etcd-backups RETENTION_DAYS=14 /home/ubuntu/etcd-tools/etcd-backup.sh
```

crontab 예시:

```bash
sudo crontab -e
```

```cron
0 2 * * * /home/ubuntu/etcd-tools/etcd-backup.sh >> /var/log/etcd-backup.log 2>&1
```

- 백업 로그 경로: `192.168.56.10` 의 `/var/log/etcd-backup.log`
- 로그 회전 설정 경로: `192.168.56.10` 의 `/etc/logrotate.d/etcd-backup`
- 권장 로그 회전 정책:
  - daily
  - `rotate 14`
  - compress
  - missingok
  - notifempty
- 2026-04-20 기준 `logrotate -f /etc/logrotate.d/etcd-backup` 강제 회전 테스트 완료

복원 기본 절차:

```bash
sudo gunzip -c /var/backups/etcd/etcd-snapshot-YYYY-MM-DD-HHMMSS.db.gz > /tmp/etcd-restore.db
sudo /home/ubuntu/etcd-tools/etcdutl snapshot restore /tmp/etcd-restore.db --data-dir /var/lib/etcd-restore
```

- 복원 전 기존 `/var/lib/etcd` 는 반드시 별도 백업
- restore 후 control plane 노드의 `/etc/kubernetes/manifests/etcd.yaml` 에서 `data-dir` 사용 경로와 실제 운영 절차를 환경에 맞게 조정 필요
- 실무에서는 snapshot 파일을 NAS/NFS 같은 별도 스토리지에도 함께 복사 권장
- 백업은 배치로 자동화 가능하지만, 복원은 수동 장애조치 절차임
- 테스트용 임시 경로 예:
  - `/tmp/etcd-restore-from-script.db`
  - `/tmp/etcd-restore-from-script`
  - 운영 백업 위치인 `/var/backups/etcd` 와 구분해서 사용

장애 시 최소 복원 순서:

1. 기존 `/var/lib/etcd` 를 다른 경로로 백업
2. 최신 snapshot 을 `/tmp/etcd-restore.db` 로 압축 해제
3. `/home/ubuntu/etcd-tools/etcdutl snapshot restore ... --data-dir <restore-dir>` 실행
4. `/etc/kubernetes/manifests/etcd.yaml` 의 `data-dir` 를 복구 디렉터리로 맞추거나 복구 결과를 운영 경로로 교체
5. `etcd`, `kube-apiserver`, `kubectl get nodes` 순서로 정상화 확인

## 검증 명령

```bash
kubectl get nodes -o wide
kubectl get svc -A
kubectl get ingress -A
```
