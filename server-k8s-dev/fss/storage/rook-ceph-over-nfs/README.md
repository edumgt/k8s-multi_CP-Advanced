# Rook-Ceph over NFS (OMV) - POC Notes

## 배경
- 금감원 시뮬레이션 NFS 서버(OMV)를 `192.168.10.2`로 사용.
- OMV 관리 UI: `http://10.111.111.75:8080`
- 본 디렉터리는 "Rook-Ceph over NFS" 검토 전 단계로, OMV NFS 자체의 연결/쓰기/권한 상태를 검증하기 위한 산출물.

## 지금까지 진행 요약
1. K8s/앱/인프라 분리 운영 방향 정리
- namespace: `app`, `dis`, `infra`, `sample`, `unitest` 기준으로 정리.
- MongoDB/Redis는 PV 기반 지속성 전제로 구성.

2. Harbor/GitLab/배포 경로 확인
- Harbor(10.111.111.72) 저장소 목록/증감 확인.
- GitLab(10.111.111.71) 프로젝트 존재/생성시각 확인.
- bastion 중심 작업 원칙으로 전환하여 서버 경로 산출물 누적.

3. OMV NFS 실측 검증
- 모든 K8s 노드에서 `192.168.10.2:2049` 접근 및 마운트 가능 확인.
- 초기에는 `/` export는 RO, `/nfs` export는 mount되나 write 권한 거부.
- OMV NFS 공유 설정 조정(사용자 Apply 완료) 후 재검증 단계 진입.

## 핵심 주의
- `Ceph on top of NFS`(OSD 데이터를 NFS에 직접 저장)는 일반적으로 비권장 구조.
- 여기서는 우선 "NFS 경로를 K8s에서 안정적으로 RW 사용 가능한가"를 검증.

## 현재까지 실측 결과 (2026-04-14)
1. 노드 네트워크
- 4개 노드(`hdlamst-devl`, `hdlawork1-devl`, `hdlawork2-devl`, `hdlaworkml-devl`)에서 `192.168.10.2:2049` 접근 가능.

2. 노드별 마운트
- 노드 고정 pod + `nfs: 192.168.10.2:/` 마운트 성공.
- `df -h /mnt`에서 NFS 파일시스템 정상 인식.

3. export 경로 확인
- `/` 경로는 읽기전용 동작.
- `/nfs` 경로는 마운트되지만 쓰기 시 `Permission denied` 발생.

4. 결론
- "각 노드가 OMV NFS를 마운트 가능한가?" -> 가능.
- "쓰기/파일 생성 가능한가?" -> 현재 OMV export 권한/ACL 설정 추가 조정 필요.

## 테스트가 의미하는 것
1. 각 노드가 NFS 네트워크에 도달 가능한지
2. PV/PVC가 NFS export에 바인딩 가능한지
3. pod 내부 `df -h`로 용량/마운트 확인
4. `dd`로 쓰기 가능 여부 확인
5. 쓰기 실패 시 RO/permission 문제를 분리 진단

## 빠른 실행
```bash
cd /home/disadm/fss-support/k8s-dev/fss/storage/rook-ceph-over-nfs
cp omv-nfs.env.example omv-nfs.env
# 실제 값 확인 후 실행
bash apply-omv-nfs-poc.sh
bash test-omv-nfs-poc.sh
bash node-mount-check.sh
```

## "적용 완료" 이후 바로 할 일
1. OMV 화면 상단 노란 배너가 사라졌는지 확인
- `Pending configuration changes`가 없어야 실제 반영 상태.

2. K8s에서 즉시 재검증
```bash
cd /home/disadm/fss-support/k8s-dev/fss/storage/rook-ceph-over-nfs
bash test-omv-nfs-poc.sh
bash node-mount-check.sh
```

3. 성공 판정
- `dd ... of=/mnt/nfs/...`가 `Permission denied` 없이 완료.
- 생성 파일이 `ls -al /mnt/nfs`에 표시.
- 필요시 OMV 서버 실제 export 경로에서도 동일 파일 확인.

## OMV에서 반드시 확인할 설정
1. `Storage > Shared Folders > nfs`
- Privileges/ACL에서 쓰기 가능한 계정/그룹 권한 부여

2. `Services > NFS > Shares`
- Client: `192.168.10.0/24`
- Permission: `Read/Write`
- Extra options: `no_root_squash,no_subtree_check,insecure`
- 저장 후 상단 `Apply`

## 판정 기준
- `kubectl -n sample get pvc,pod` 에서 test pod Running
- pod 내부 `df -h /mnt/nfs` 또는 `df -h /mnt` 정상
- `dd if=/dev/zero ... of=/mnt/...` 쓰기 성공
- `ls`로 생성 파일 확인
- 필요 시 OMV 서버 경로에서 동일 파일 확인

## 다음 단계 (Rook-Ceph over NFS 검토)
- OMV NFS RW가 안정화되면 Rook-Ceph POC 매니페스트(Operator/Cluster/CephFS or RBD)로 확장.
- 단, 성능/운영복잡도 관점에서 NFS 위 Ceph 구조의 리스크 평가를 선행.

## 개발 산출물 반영 여부
- 반영됨.
- 본 경로의 스크립트/문서가 현재 기준 산출물:
  - `apply-omv-nfs-poc.sh`
  - `test-omv-nfs-poc.sh`
  - `node-mount-check.sh`
  - `cleanup-omv-nfs-poc.sh`
  - `omv-nfs.env.example`
