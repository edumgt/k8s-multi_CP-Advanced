## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API Server(예: `192.168.56.10:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# Rook-Ceph over NFS POC Test Guide

이 디렉터리는 `Rook-Ceph over NFS` 검토 전에, Kubernetes에서 NFS 경로를 안정적으로 RW로 사용할 수 있는지 검증하는 POC 산출물입니다.

## 목적
- NFS 서버 export를 PV/PVC로 연결 가능한지 확인
- Pod 내부에서 실제 마운트/쓰기 가능한지 확인
- 다중 worker 노드에서 동일 NFS 경로 접근 가능한지 확인

## 현재 기준 테스트 환경
- Control Plane 접속: `ubuntu@192.168.56.10`
- NFS Target: `192.168.56.20:/nfs`
- 테스트 네임스페이스: `sample`
- 테스트 이미지: `ghcr.io/edumgt/fss-dis-server-node:latest`

## 사전 조건
1. 클러스터가 정상(`kubectl get nodes` 모두 Ready)
2. NFS 서버에서 `/nfs` export가 RW 허용
3. `omv-nfs.env` 값 확인

```bash
cd /home/k8s-fss/server-k8s-dev/fss/storage/rook-ceph-over-nfs
cat omv-nfs.env
```

예시:
```env
OMV_NFS_SERVER=192.168.56.20
OMV_NFS_EXPORT=/nfs
POC_NAMESPACE=sample
POC_PV_NAME=omv-nfs-pv-poc
POC_PVC_NAME=omv-nfs-pvc-poc
POC_STORAGE_SIZE=20Gi
```

## 테스트 실행
```bash
cd /home/k8s-fss/server-k8s-dev/fss/storage/rook-ceph-over-nfs
bash apply-omv-nfs-poc.sh
bash test-omv-nfs-poc.sh
# 모든 노드를 자동 감지해 노드별 마운트를 확인 (기본 최대 4개 노드)
bash node-mount-check.sh
# 특정 개수만 확인하려면
MAX_NODES=2 bash node-mount-check.sh
```

## 성공 여부 확인 방법 (핵심)
아래 5개를 모두 통과하면 POC 성공입니다.

### 1) PV/PVC 바인딩 확인
```bash
kubectl get pv omv-nfs-pv-poc -o wide
kubectl -n sample get pvc omv-nfs-pvc-poc -o wide
```
- 기대값: `STATUS=Bound`

### 2) 실제 NFS 타깃 확인
```bash
kubectl get pv omv-nfs-pv-poc -o jsonpath='{.spec.nfs.server}:{.spec.nfs.path}{"\n"}'
```
- 기대값: `192.168.56.20:/nfs`

### 3) 테스트 Pod 상태 확인
```bash
kubectl -n sample get pod omv-nfs-tester -o wide
```
- 기대값: `1/1 Running`

### 4) Pod 내부 마운트/쓰기 검증
```bash
kubectl -n sample exec omv-nfs-tester -- sh -c 'df -h /mnt/nfs; ls -al /mnt/nfs | tail -n 20'
kubectl -n sample exec omv-nfs-tester -- sh -c 'dd if=/dev/zero of=/mnt/nfs/ceph-poc-check-$(date +%s).bin bs=1M count=16'
kubectl -n sample exec omv-nfs-tester -- sh -c 'ls -al /mnt/nfs | tail -n 20'
```
- 기대값:
  - `df`에 `192.168.56.20:/nfs` 표시
  - `dd`가 에러 없이 완료
  - `ceph-poc-check-*.bin` 생성 확인

### 5) 문제 발생 시 이벤트/상태 확인
```bash
kubectl -n sample describe pod omv-nfs-tester
kubectl -n sample get events --sort-by=.lastTimestamp | tail -n 40
```

## 결과 해석
- `Bound + Running + dd 성공`이면 NFS RW 경로가 정상
- 이벤트에 과거 `ImagePullBackOff`가 보여도, 현재 Pod가 `Running`이고 최근 쓰기가 성공하면 현재 상태는 정상

## 자주 발생하는 실패 원인
1. `ImagePullBackOff`
- 증상: Pod Pending/ImagePullBackOff
- 조치: GHCR 이미지 사용 확인 (`ghcr.io/edumgt/fss-dis-server-node:latest`)

2. `Permission denied` (쓰기 실패)
- 증상: `dd`/`touch` 실패
- 조치: NFS 서버 export를 RW로 수정, ACL/권한 재확인

3. `FailedMount`
- 증상: Pod가 `ContainerCreating`에서 멈춤
- 조치: NFS 서버 IP/경로, 네트워크 접근(2049), export 옵션 확인

## 정리(선택)
테스트 종료 후 리소스 정리:
```bash
cd /home/k8s-fss/server-k8s-dev/fss/storage/rook-ceph-over-nfs
bash cleanup-omv-nfs-poc.sh
kubectl delete pv omv-nfs-pv-poc --ignore-not-found=true
```

## 포함 스크립트
- `apply-omv-nfs-poc.sh`: PV/PVC/테스트 Pod 생성
- `test-omv-nfs-poc.sh`: 마운트/쓰기 재검증
- `node-mount-check.sh`: 노드 자동 감지 기반 NFS 마운트 검증
- `cleanup-omv-nfs-poc.sh`: 테스트 Pod/PVC 정리
- `omv-nfs.env.example`: 환경 변수 템플릿
- `nfs-test-hello-py.yaml`, `hello.py`: Python 기반 NFS 쓰기 검증 샘플
- `check-rook-ceph-nfs-poc.sh`: (선택) rook-ceph/rook-ceph-nfs 상태 점검 도구
