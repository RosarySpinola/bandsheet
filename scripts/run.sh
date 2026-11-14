#!/usr/bin/env bash
# Run a TypeScript script with the workspace's tsx. Usage: scripts/run.sh seed-demo.ts [args]
cd "$(dirname "$0")" && exec ../server/node_modules/.bin/tsx "$@"
