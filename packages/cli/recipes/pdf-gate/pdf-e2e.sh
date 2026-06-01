#!/usr/bin/env bash
# PDF/render e2e gate — builds the real deploy image, boots it, and asserts
# the render endpoint returns real output. Adapted from Anser-Portal's
# scripts/dev/e2e-pdf-like-railway.sh.
#
# This is a STUB: fill in the TODOs for your app. It deliberately fails loudly
# if they're unset rather than testing the wrong thing.
set -euo pipefail

# TODO(you): the render endpoint to probe, relative to the booted app.
PDF_PATH="${PDF_PATH:-}"
# TODO(you): seeded login, if the route requires auth (else leave blank).
LOGIN_EMAIL="${LOGIN_EMAIL:-}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"
PORT="${PORT:-8080}"

if [[ -z "$PDF_PATH" ]]; then
  echo "iv pdf-gate: set PDF_PATH to your render endpoint (see the TODOs in this file)." >&2
  exit 2
fi

echo "iv pdf-gate: building deploy image…"
docker build -t iv-pdf-e2e .

echo "iv pdf-gate: booting…"
cid=$(docker run -d -p "${PORT}:${PORT}" -e PORT="$PORT" iv-pdf-e2e)
cleanup() { docker rm -f "$cid" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Wait for the app to answer.
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then break; fi
  sleep 1
done

# TODO(you): if auth is needed, exchange LOGIN_* for a cookie/token here and
# pass it to the curl below. The stub fetches unauthenticated.
echo "iv pdf-gate: fetching ${PDF_PATH}…"
out=$(mktemp)
curl -fsS "http://127.0.0.1:${PORT}${PDF_PATH}" -o "$out"

# Assert the bytes are a real PDF, not an HTML error page.
if [[ "$(head -c 4 "$out")" == "%PDF" ]]; then
  echo "iv pdf-gate: OK — %PDF bytes received ($(wc -c <"$out") bytes)."
else
  echo "iv pdf-gate: FAIL — response did not start with %PDF." >&2
  head -c 400 "$out" >&2
  exit 1
fi
