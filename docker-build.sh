#!/usr/bin/env bash
set -e

docker rm -f forecast-mcp 2>/dev/null || true
docker rmi -f forecast-mcp 2>/dev/null || true
npm run build
docker build -t forecast-mcp .
