#!/bin/sh
# Records Clashfinder responses for the lineup source tests.
# Usage, from the repository root: sh test/fixtures/clashfinder/record.sh <output directory> <page ID>...
# The script reads CLASHFINDER_USERNAME and CLASHFINDER_PRIVATE_KEY from .env.
# It waits 10 seconds between requests (robots.txt "Crawl-delay: 10").
# Before you copy a file to this directory, replace the username in "authUsername"
# with "test-clashfinder-user".
set -eu
set -a; . ./.env; set +a
out=$1; shift
key=$(printf '%s%s' "$CLASHFINDER_USERNAME" "$CLASHFINDER_PRIVATE_KEY" | sha256sum | cut -d' ' -f1)
for page in "$@"; do
  curl -sS --compressed -o "$out/event-$page.json" -w "$page: status %{http_code}\n" --get \
    --data-urlencode "authUsername=$CLASHFINDER_USERNAME" --data-urlencode "authPublicKey=$key" \
    "https://clashfinder.com/data/event/$page.json"
  sleep 10
done
curl -sS --compressed -o "$out/all.json" -w "all.json: status %{http_code}\n" --get \
  --data-urlencode "authUsername=$CLASHFINDER_USERNAME" --data-urlencode "authPublicKey=$key" \
  "https://clashfinder.com/data/events/all.json"
