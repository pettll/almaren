#!/usr/bin/env bash
# Run this ON the server (as root, e.g. `sudo bash deploy.sh`) after
# cloud-init.yaml has finished. Safe to re-run for updates: it pulls the
# latest main, reinstalls deps, applies migrations, and restarts the
# service. Idempotent .env/Caddyfile/systemd setup on first run.
set -euo pipefail

REPO_URL="https://github.com/pettll/almaren.git"
APP_DIR="/opt/almaren"
SERVICE_NAME="almaren"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (sudo bash deploy.sh)" >&2
  exit 1
fi

if [ -d "$APP_DIR/.git" ]; then
  echo "==> Fetching latest main"
  sudo -u almaren git -C "$APP_DIR" fetch origin main
  # Hard reset rather than a fast-forward pull: this checkout only ever
  # tracks origin/main and holds no independent commits, so it should
  # always exactly mirror the remote. A plain --ff-only pull breaks the
  # moment main's history is ever rewritten (e.g. a rebase to scrub
  # something), which has happened at least once already.
  sudo -u almaren git -C "$APP_DIR" reset --hard origin/main
else
  echo "==> Cloning $REPO_URL"
  sudo -u almaren git clone --branch main "$REPO_URL" "$APP_DIR"
fi

echo "==> Installing dependencies"
sudo -u almaren -H bash -c "cd '$APP_DIR' && npm ci"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "==> Writing initial .env (edit later to add GitHub OAuth credentials)"
  AUTH_SECRET="$(openssl rand -hex 32)"
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="file:$APP_DIR/prisma/dev.db"
AUTH_SECRET="$AUTH_SECRET"
GITHUB_ID=""
GITHUB_SECRET=""
EOF
  chown almaren:almaren "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi

echo "==> Applying database migrations"
sudo -u almaren -H bash -c "cd '$APP_DIR' && npx prisma migrate deploy"

echo "==> Building (production mode needs a prior 'next build'; on small"
echo "    instances this leans on the swap file from cloud-init)"
sudo -u almaren -H bash -c "cd '$APP_DIR' && npm run build"

echo "==> Configuring Caddy (automatic HTTPS via sslip.io)"
PUBLIC_IP="$(curl -fsSL ifconfig.me)"
DOMAIN="$(echo "$PUBLIC_IP" | tr '.' '-').sslip.io"
sed "s/{DOMAIN}/$DOMAIN/" "$APP_DIR/deploy/Caddyfile.template" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Installing systemd service"
cp "$APP_DIR/deploy/almaren.service" /etc/systemd/system/almaren.service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo
echo "Done. Almaren should be live at: https://$DOMAIN"
echo "Check status with: systemctl status almaren"
echo "Check logs with:   journalctl -u almaren -f"
