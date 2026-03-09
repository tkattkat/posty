#!/bin/bash

set -e

# Read version from tauri.conf.json
VERSION=$(grep -o '"version": "[^"]*"' src-tauri/tauri.conf.json | head -1 | cut -d'"' -f4)

if [ -z "$VERSION" ]; then
  echo "Error: Could not read version from src-tauri/tauri.conf.json"
  exit 1
fi

TAG="v$VERSION"

echo "Releasing $TAG..."

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: You have uncommitted changes. Commit them first."
  exit 1
fi

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Tag $TAG already exists. Bump the version in src-tauri/tauri.conf.json first."
  exit 1
fi

# Create and push tag
git tag "$TAG"
git push origin "$TAG"

echo "Done! Tag $TAG pushed. GitHub Actions will build the release."
echo "Watch progress at: https://github.com/tkattkat/posty/actions"
