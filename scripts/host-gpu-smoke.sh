#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-nvidia/cuda:12.5.1-base-ubuntu24.04}"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "[ERROR] nvidia-smi not found in this environment."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker CLI not found. Check Docker Desktop WSL integration."
  exit 1
fi

echo "[INFO] host GPU check"
nvidia-smi

echo "[INFO] docker GPU check with image: ${IMAGE}"
docker run --rm --gpus all "${IMAGE}" nvidia-smi

echo "[OK] host + docker GPU smoke test passed."
