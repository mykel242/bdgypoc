# Budgie Quick Start

## Installation

### macOS
```bash
brew install podman podman-compose
```

### Linux
```bash
sudo apt-get install -y podman podman-compose  # Debian/Ubuntu
# or
sudo dnf install -y podman podman-compose      # Fedora/RHEL
```

## Usage

```bash
git checkout containerize-with-podman
./container-dev.sh start
```

That's it! The script handles:
- Podman machine initialization (macOS)
- Port 80 configuration (Linux)
- Environment file setup
- Container startup

## Access

- **Development**: http://localhost:5173/budgie-v2/
- **Production**: http://localhost/budgie-v2/

## Commands

```bash
./container-dev.sh start      # Start (foreground)
./container-dev.sh start-bg   # Start (background)
./container-dev.sh stop       # Stop
./container-dev.sh logs       # View logs
./container-dev.sh clean      # Remove all data
```

## Production Deployment

1. Edit `.env.production` with your secrets
2. Run: `./container-dev.sh start-bg`

Done!
