#!/bin/bash

# Budgie Clean + Deploy Script
# Runs cleanup followed by fresh deployment

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

echo "============================================"
echo "  Budgie Clean + Deploy"
echo "============================================"
echo

# Check if on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}[✗]${NC} This script should only be run on Linux (Cronus)"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Step 1: Clean
print_info "Step 1: Cleaning existing installation..."
bash "$SCRIPT_DIR/clean-cronus.sh"

echo
echo "============================================"
echo

# Step 2: Deploy
print_info "Step 2: Deploying fresh installation..."
bash "$SCRIPT_DIR/deploy-to-cronus.sh" install

echo
print_status "Clean + Deploy complete!"
print_info "The application has been completely reinstalled from scratch"
