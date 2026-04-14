#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat <<MSG
[init.sh] Legacy VM bootstrap flow has been removed.
[init.sh] This repository is now aligned to 3.docx server migration mode.
[init.sh] 인프라 노드 자동 실행은 지원하지 않습니다.
[init.sh] 필요한 Kubernetes 노드를 먼저 기동한 뒤 아래 명령을 진행하세요.
[init.sh] Apply manifests directly:
  kubectl apply -k "${ROOT_DIR}/02-infrastructure/k8s/fss/overlays/dev"
MSG
