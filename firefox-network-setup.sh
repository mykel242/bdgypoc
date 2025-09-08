#!/bin/bash

# Setup script for Firefox network drive access
# This creates a symbolic link in Downloads pointing to your network drive

echo "Firefox Network Drive Setup"
echo "=========================="
echo ""

# Get network drive path from user
read -p "Enter the full path to your network drive folder: " NETWORK_PATH

# Validate the path exists
if [ ! -d "$NETWORK_PATH" ]; then
    echo "❌ Error: Directory '$NETWORK_PATH' does not exist"
    exit 1
fi

# Create a symbolic link in Downloads
LINK_NAME="$HOME/Downloads/BudgieNetwork"

# Remove existing link if it exists
if [ -L "$LINK_NAME" ]; then
    echo "Removing existing link..."
    rm "$LINK_NAME"
fi

# Create new symbolic link
ln -s "$NETWORK_PATH" "$LINK_NAME"

if [ -L "$LINK_NAME" ]; then
    echo "✅ Success! Created link:"
    echo "   $LINK_NAME → $NETWORK_PATH"
    echo ""
    echo "Now when you save in Firefox:"
    echo "1. Files will save to Downloads"
    echo "2. Navigate to 'BudgieNetwork' folder in Downloads"
    echo "3. This actually saves to your network drive"
else
    echo "❌ Failed to create symbolic link"
    exit 1
fi