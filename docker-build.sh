#!/usr/bin/env bash
set -e

docker rm -f forecast-mcp 2>/dev/null || true
docker rmi -f forecast-mcp 2>/dev/null || true
pnpm run build
docker build -t forecast-mcp .
