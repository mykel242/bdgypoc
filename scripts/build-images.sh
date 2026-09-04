#!/bin/bash
# Build Budgie's two local images.
#
# Quadlet cannot build images: .build units need Podman 5.0+ and this host
# runs 4.9.3. So the build is an explicit step, the same way ops-agent
# handles its own locally-built image. Compose used to do this implicitly
# via `up -d --build`; nothing does it implicitly any more.
#
# Run this after any change to backend/ or frontend/, then restart the
# affected service so the new image is picked up:
#
#   /opt/budgie/scripts/build-images.sh
#   systemctl --user restart budgie-backend.service budgie-frontend.service

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/budgie}"
cd "$PROJECT_DIR"

echo "==> budgie_backend"
podman build -f Dockerfile.backend --target production \
    -t localhost/budgie_backend:latest .

echo "==> budgie_frontend"
podman build -f Dockerfile.frontend --target production \
    -t localhost/budgie_frontend:latest .

echo
echo "Built:"
podman images --format '  {{.Repository}}:{{.Tag}}  {{.Created}}' \
    | grep -E 'budgie_(backend|frontend)'
echo
echo "Restart to pick them up:"
echo "  systemctl --user restart budgie-backend.service budgie-frontend.service"
