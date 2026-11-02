#!/bin/bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
tsx_cli="$repo_root/node_modules/tsx/dist/cli.mjs"
if [[ ! -f "$tsx_cli" ]]; then
  printf 'Missing tsx runtime at %s. Run npm install from the repository root: %s\n' "$tsx_cli" "$repo_root" >&2
  exit 2
fi
exec node "$tsx_cli" "$script_dir/check.ts" "$@"
