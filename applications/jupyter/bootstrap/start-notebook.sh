#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${JUPYTER_ROOT_DIR:-/workspace}"
BASE_URL="${JUPYTER_BASE_URL:-/}"

mkdir -p "${ROOT_DIR}"

# Ensure the default python kernel is present so notebook "Run" actions are enabled.
python3 -m ipykernel install --sys-prefix --name python3 --display-name "Python 3"

exec jupyter lab \
  --ip=0.0.0.0 \
  --port=8888 \
  --no-browser \
  --allow-root \
  --ServerApp.base_url="${BASE_URL}" \
  --ServerApp.token="${JUPYTER_TOKEN:-platform123}" \
  --ServerApp.allow_origin="*" \
  --ServerApp.root_dir="${ROOT_DIR}" \
  --ServerApp.default_url="${BASE_URL}/lab/tree/personal"
