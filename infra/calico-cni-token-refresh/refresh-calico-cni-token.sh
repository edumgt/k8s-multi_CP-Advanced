#!/usr/bin/env bash
set -euo pipefail

KUBECONFIG_PATH="${KUBECONFIG_PATH:-/etc/calico-cni-token-refresher/kubeconfig}"
CALICO_KUBECONFIG_PATH="${CALICO_KUBECONFIG_PATH:-/etc/cni/net.d/calico-kubeconfig}"
TOKEN_DURATION="${TOKEN_DURATION:-24h}"
LOCKFILE="${LOCKFILE:-/run/calico-cni-token-refresh.lock}"

exec 9>"$LOCKFILE"
flock -n 9 || exit 0

if [[ ! -f "$KUBECONFIG_PATH" ]]; then
  echo "missing kubeconfig: $KUBECONFIG_PATH" >&2
  exit 1
fi

if [[ ! -f "$CALICO_KUBECONFIG_PATH" ]]; then
  echo "missing calico kubeconfig: $CALICO_KUBECONFIG_PATH" >&2
  exit 1
fi

new_token="$(
  kubectl \
    --kubeconfig "$KUBECONFIG_PATH" \
    create token calico-cni-plugin \
    -n kube-system \
    --duration "$TOKEN_DURATION"
)"

tmpfile="$(mktemp)"
trap 'rm -f "$tmpfile"' EXIT

awk -v token="$new_token" '
  /^[[:space:]]*token:/ {
    sub(/token:.*/, "token: " token)
  }
  { print }
' "$CALICO_KUBECONFIG_PATH" > "$tmpfile"

install -m 0600 "$tmpfile" "$CALICO_KUBECONFIG_PATH"
