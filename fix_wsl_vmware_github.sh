#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash fix_wsl_vmware_github.sh [VMWARE_HOST]
# Example:
#   bash fix_wsl_vmware_github.sh vcsa.company.local

VMWARE_HOST="${1:-www.vmware.com}"

echo "[1/5] WSL DNS 고정 설정 (/etc/wsl.conf, /etc/resolv.conf)"
sudo tee /etc/wsl.conf >/dev/null <<'EOW'
[network]
generateResolvConf = false
EOW

sudo rm -f /etc/resolv.conf
sudo tee /etc/resolv.conf >/dev/null <<'EOR'
nameserver 1.1.1.1
nameserver 8.8.8.8
options timeout:2 attempts:2
EOR
sudo chmod 644 /etc/resolv.conf

echo "[2/5] DNS/HTTPS 점검"
getent hosts github.com | head -n 1
getent hosts "$VMWARE_HOST" | head -n 1 || true
curl -I https://github.com --max-time 10 | head -n 3
curl -I "https://$VMWARE_HOST" --max-time 10 | head -n 3 || true

echo "[3/5] GitHub SSH 키 생성(없을 때만)"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
if [[ ! -f "$HOME/.ssh/id_ed25519" ]]; then
  ssh-keygen -t ed25519 -C "$(whoami)@wsl" -N "" -f "$HOME/.ssh/id_ed25519"
fi

cat > "$HOME/.ssh/config" <<'EOS'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
EOS
chmod 600 "$HOME/.ssh/config"

echo "[4/5] GitHub 공개키"
cat "$HOME/.ssh/id_ed25519.pub"
echo

echo "[5/5] SSH 접속 테스트 (키 등록 전이면 Permission denied가 정상)"
ssh -T git@github.com -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 || true

echo
printf '%s\n' "다음 단계:"
printf '%s\n' "1) 위에서 출력된 공개키를 GitHub > Settings > SSH and GPG keys에 등록"
printf '%s\n' "2) Windows PowerShell에서: wsl --shutdown"
printf '%s\n' "3) WSL 재실행 후: getent hosts github.com && curl -I https://github.com"
