#!/usr/bin/env bash
# Fails when a built client holds demo-only text. The real (api) build must hold
# no demo code. Used by CI twice: on the client built by npm, and on the files
# inside the web image.
# Usage: tools/check-no-demo-code.sh <folder with the built client's assets>
set -euo pipefail

folder="${1:?Usage: check-no-demo-code.sh <assets folder>}"
[ -d "$folder" ] || { echo "::error::No such folder: $folder"; exit 1; }

markers=(
  "Reset demo" "Interactive preview" "Try the demo" "hand-written sample"
  "scripted replies have run out" "Home-cooked meals" "Ev yemekleri"
  "interviewer.md" "idea-discovery-rooms-demo" "Replies here are examples"
)

failed=0
for marker in "${markers[@]}"; do
  if grep -rqF -- "$marker" "$folder"; then
    echo "::error::The api build contains demo text: $marker"
    failed=1
  fi
done
exit $failed
