#!/usr/bin/env bash
set -euo pipefail

NS_MAIN="rook-ceph"
NS_NFS="rook-ceph-nfs"
CL_NFS="rook-ceph-nfs"

echo "[1/6] 기존 로컬 클러스터 상태(${NS_MAIN})"
kubectl -n "${NS_MAIN}" get pod -o wide

echo

echo "[2/6] NFS 기반 별도 클러스터 상태(${NS_NFS})"
kubectl -n "${NS_NFS}" get cephcluster "${CL_NFS}" -o wide
kubectl -n "${NS_NFS}" get pod -o wide

echo

echo "[3/6] Ready/Health 요약"
kubectl -n "${NS_NFS}" get cephcluster "${CL_NFS}" \
  -o jsonpath='name={.metadata.name}{"\n"}phase={.status.phase}{"\n"}health={.status.ceph.health}{"\n"}message={.status.message}{"\n"}'

echo

echo "[4/6] OSD prepare pod 로그에서 NFS loopback 근거 확인"
PREPARE_POD="$(kubectl -n "${NS_NFS}" get pod -l app=rook-ceph-osd-prepare -o jsonpath='{.items[-1:].metadata.name}')"
if [[ -z "${PREPARE_POD}" ]]; then
  echo "osd-prepare pod를 찾지 못했습니다. label(app=rook-ceph-osd-prepare) 확인 필요"
else
  echo "prepare pod: ${PREPARE_POD}"
  kubectl -n "${NS_NFS}" logs "${PREPARE_POD}" --tail=400 \
    | egrep -i '/dev/loop0|nfs-osd|ceph-volume raw prepare|by-loop-ref' || true
fi

echo

echo "[5/6] 판정 가이드"
echo "- phase=Ready, health=HEALTH_OK 이면 클러스터 기동은 성공"
echo "- osd-prepare 로그에서 /dev/loop0 + nfs-osd.img 근거가 보이면 NFS file 기반 OSD 경로 확인"
echo "- ${NS_MAIN} 과 ${NS_NFS} 가 동시에 Running이면 로컬 기반 유지 + 별도 NFS POC 병행 성공"

echo

echo "[6/6] 선택: 간단 장애 체크"
kubectl -n "${NS_NFS}" get events --sort-by=.lastTimestamp | tail -n 20 || true
