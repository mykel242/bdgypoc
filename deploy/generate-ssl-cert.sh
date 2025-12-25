#!/bin/bash
# Generate self-signed SSL certificate for Budgie
# Usage: ./generate-ssl-cert.sh [domain]

set -e

DOMAIN="${1:-localhost}"
CERT_DIR="$(dirname "$0")/ssl"
DAYS_VALID=365

echo "Generating self-signed SSL certificate for: $DOMAIN"
echo "Certificate directory: $CERT_DIR"
echo "Valid for: $DAYS_VALID days"
echo ""

# Create certificate directory
mkdir -p "$CERT_DIR"

# Generate private key and certificate
openssl req -x509 -nodes -days "$DAYS_VALID" -newkey rsa:2048 \
    -keyout "$CERT_DIR/budgie.key" \
    -out "$CERT_DIR/budgie.crt" \
    -subj "/C=US/ST=State/L=City/O=Budgie/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"

# Set permissions
chmod 600 "$CERT_DIR/budgie.key"
chmod 644 "$CERT_DIR/budgie.crt"

echo ""
echo "SSL certificate generated successfully!"
echo ""
echo "Files created:"
echo "  - $CERT_DIR/budgie.crt (certificate)"
echo "  - $CERT_DIR/budgie.key (private key)"
echo ""
echo "To use with podman-compose, run:"
echo "  podman-compose -f compose.yml -f compose.prod.yml -f compose.ssl.yml up -d"
echo ""
echo "Note: Since this is a self-signed certificate, browsers will show a security warning."
echo "You can add an exception to proceed."
