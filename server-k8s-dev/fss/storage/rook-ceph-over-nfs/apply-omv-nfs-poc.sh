#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/omv-nfs.env"

# Re-running this script should be idempotent even if a previous tester pod exists.
kubectl -n "${POC_NAMESPACE}" delete pod omv-nfs-tester --ignore-not-found=true >/dev/null 2>&1 || true

cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: ${POC_PV_NAME}
spec:
  capacity:
    storage: ${POC_STORAGE_SIZE}
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ""
  nfs:
    server: ${OMV_NFS_SERVER}
    path: ${OMV_NFS_EXPORT}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${POC_PVC_NAME}
  namespace: ${POC_NAMESPACE}
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: ${POC_STORAGE_SIZE}
  storageClassName: ""
  volumeName: ${POC_PV_NAME}
---
apiVersion: v1
kind: Pod
metadata:
  name: omv-nfs-tester
  namespace: ${POC_NAMESPACE}
spec:
  restartPolicy: Never
  containers:
    - name: tester
      image: ghcr.io/edumgt/fss-dis-server-node:latest
      command: ["/bin/sh", "-c"]
      args:
        - |
          set -eux
          df -h /mnt/nfs
          dd if=/dev/zero of=/mnt/nfs/ceph-poc-$(date +%s).bin bs=1M count=100
          ls -al /mnt/nfs | tail -n 20
          sleep 3600
      volumeMounts:
        - name: nfs
          mountPath: /mnt/nfs
  volumes:
    - name: nfs
      persistentVolumeClaim:
        claimName: ${POC_PVC_NAME}
YAML
