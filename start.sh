#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY="${1:-dev}"

case "$OVERLAY" in
  dev|prod) ;;
  *)
    echo "Usage: $0 [dev|prod]"
    exit 1
    ;;
esac

if ! kubectl get nodes >/dev/null 2>&1; then
  cat <<'MSG'
[start.sh] Kubernetes API에 연결할 수 없습니다.
[start.sh] 저장소에서 인프라 노드 자동 실행은 지원하지 않습니다.
[start.sh] 필요한 Kubernetes 노드(control-plane/worker)를 먼저 기동한 뒤 다시 시도하세요.
MSG
  exit 1
fi

echo "[start.sh] Applying FSS manifests overlay: ${OVERLAY}"
kubectl apply -k "${ROOT_DIR}/02-infrastructure/k8s/fss/overlays/${OVERLAY}"

echo "[start.sh] Done."
if [[ "${OVERLAY}" == "dev" ]]; then
  echo "[start.sh] MetalLB / ingress access check:"
  echo "  kubectl -n ingress-nginx get svc ingress-nginx-controller -o wide"
fi
