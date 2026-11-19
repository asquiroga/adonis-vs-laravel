#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
first="${1:?Usage: $0 LABEL_A LABEL_B}"
second="${2:?Usage: $0 LABEL_A LABEL_B}"
diff -ru "results/contracts/v2/$first" "results/contracts/v2/$second"
echo 'v2 deterministic read contracts are byte-equivalent after canonical JSON sorting.'
