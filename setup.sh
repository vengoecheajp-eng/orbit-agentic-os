#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Orbit requires Node.js ^20.19.0 or >=22.12.0."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Orbit requires Git."
  exit 1
fi

npm install
npm run doctor

echo
echo "Orbit is installed. Start it with: npm run dev:orbit"
