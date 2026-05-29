#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/package.json"

CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' "$PKG" | sed 's/"version": *"//;s/"//')
echo "Current version: v${CURRENT_VERSION}"
printf "New version: "
read -r NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
  echo "No version provided, aborting." >&2
  exit 1
fi

sed -i.bak "s/\"version\": \"${CURRENT_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" "$PKG"
rm -f "${PKG}.bak"

cd "$ROOT"
git add .
git commit -m "release: v${NEW_VERSION}"
git tag "v${NEW_VERSION}"
git push -u origin HEAD
git push --tags

echo ""
echo "v${NEW_VERSION} released! GitHub Actions will build and publish the release."
