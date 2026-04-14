#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/omv-nfs.env"

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
    - name: busybox
      image: 10.111.111.72:80/library/busybox:latest
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
