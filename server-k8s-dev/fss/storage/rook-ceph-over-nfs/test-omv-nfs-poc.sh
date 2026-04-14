#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/omv-nfs.env"

kubectl -n "${POC_NAMESPACE}" get pod omv-nfs-tester
kubectl -n "${POC_NAMESPACE}" logs omv-nfs-tester --tail=200
kubectl -n "${POC_NAMESPACE}" exec omv-nfs-tester -- sh -c 'df -h /mnt/nfs; ls -al /mnt/nfs | tail -n 20'
kubectl -n "${POC_NAMESPACE}" exec omv-nfs-tester -- sh -c "dd if=/dev/zero of=/mnt/nfs/ceph-poc-test-\$(date +%s).bin bs=1M count=16"
kubectl -n "${POC_NAMESPACE}" exec omv-nfs-tester -- sh -c 'ls -al /mnt/nfs | tail -n 20'
