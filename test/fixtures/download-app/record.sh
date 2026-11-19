#!/bin/sh
# Records Download app API responses for the lineup source tests.
# Usage, from the repository root: sh test/fixtures/download-app/record.sh <output directory>
# The script reads DOWNLOAD_APP_KEY from .env, or from the environment if .env does not exist.
# It sends only the requests and the headers that the Android app (version 13.4.2) sends.
# It waits 5 seconds between requests.
# Before you copy edition.json to this directory, replace the value of "sns_topic_arn"
# with "arn:aws:sns:eu-west-1:000000000000:test-topic".
set -eu
if [ -f ./.env ]; then set -a; . ./.env; set +a; fi
out=$1
festival=downloadfestival
edition=downloadfestival2026
base="https://app.appmiral.com/api/v7/events/$festival/editions/$edition"

get() {
  curl -sS --compressed -o "$out/$1" -w "$1: status %{http_code}\n" \
    -H "Accept: application/json" -H "Content-Type: application/json" \
    -H "Accept-Language: en" -H "x-platform: android" -H "x-app-version: 13.4.2" \
    -H "x-os-version: 35" -H "x-event-identifier: $festival" -H "x-edition-identifier: $edition" \
    -H "x-protect: $DOWNLOAD_APP_KEY" -A "okhttp/4.12.0" "$2"
  sleep 5
}

get edition.json "$base"
get stages.json "$base/stages?max_per_page=250"
url="$base/artists?include_related=true&max_per_page=250"
page=1
while [ -n "$url" ] && [ "$url" != "null" ]; do
  get "artists-$page.json" "$url"
  url=$(jq -r '._links.next // empty' "$out/artists-$page.json")
  page=$((page + 1))
done
