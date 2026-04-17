#!/usr/bin/env bash
set -euo pipefail

NAME="${ML_GPU_CONTAINER_NAME:-ml-gpu-smoke}"
IMAGE="${ML_GPU_IMAGE:-nvidia/cuda:12.5.1-base-ubuntu24.04}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker CLI not found."
  exit 1
fi

echo "[INFO] removing old container (if exists): ${NAME}"
docker rm -f "${NAME}" >/dev/null 2>&1 || true

echo "[INFO] starting GPU smoke container: ${NAME}"
docker run --rm --name "${NAME}" --gpus all "${IMAGE}" /bin/bash -lc '
  set -e
  echo "[container] nvidia-smi"
  nvidia-smi
  echo "[container] done"
'

echo "[OK] ml-gpu-smoke run completed."
