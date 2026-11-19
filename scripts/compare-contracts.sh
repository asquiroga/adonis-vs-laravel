#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 2 ]]; then echo "Usage: $0 <label-a> <label-b>" >&2; exit 1; fi
cd "$(dirname "${BASH_SOURCE[0]}")/.."
diff -ru "results/contracts/$1" "results/contracts/$2"
echo "Contracts are byte-equivalent after canonical JSON sorting."
