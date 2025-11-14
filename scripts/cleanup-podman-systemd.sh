#!/bin/bash
# Cleanup script for Podman systemd timer issues
# Run this on Cronus when you get "timer was already loaded" errors

set -e

echo "[i] Cleaning up Podman systemd timers and containers..."

# Stop all Budgie containers
echo "[1/6] Stopping containers..."
podman stop budgie-frontend budgie-backend budgie-db 2>/dev/null || true

# Remove all Budgie containers
echo "[2/6] Removing containers..."
podman rm -f budgie-frontend budgie-backend budgie-db 2>/dev/null || true

# Clean up systemd timer units
echo "[3/6] Cleaning systemd timer units..."
if systemctl --user list-unit-files "*.timer" &>/dev/null; then
    # Rootless mode
    systemctl --user stop "*.timer" 2>/dev/null || true
    systemctl --user reset-failed 2>/dev/null || true
    rm -rf ~/.config/systemd/user/*.timer 2>/dev/null || true
    systemctl --user daemon-reload
else
    # Root mode
    sudo systemctl stop "podman-*.timer" 2>/dev/null || true
    sudo systemctl reset-failed 2>/dev/null || true
    sudo rm -rf /etc/systemd/system/podman-*.timer 2>/dev/null || true
    sudo systemctl daemon-reload
fi

# Remove any stale timer files from runtime
echo "[4/6] Removing runtime timer fragments..."
rm -rf /run/user/$(id -u)/systemd/transient/*.timer 2>/dev/null || true
sudo rm -rf /run/systemd/transient/*.timer 2>/dev/null || true

# Prune Podman system
echo "[5/6] Pruning Podman system..."
podman system prune -f --all 2>/dev/null || true

# Reset Podman if needed
echo "[6/6] Resetting Podman..."
podman system reset --force 2>/dev/null || {
    echo "[!] Podman reset failed, trying manual cleanup..."
    rm -rf ~/.local/share/containers/storage/libpod/bolt_state.db 2>/dev/null || true
}

echo "[✓] Cleanup complete! You can now run:"
echo "    cd /opt/budgie"
echo "    podman-compose -f compose.yml -f compose.prod.yml up -d --build"
