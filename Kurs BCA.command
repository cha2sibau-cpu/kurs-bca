#!/bin/bash
# Double-click this file in Finder to launch Kurs BCA.
# It starts the local server (if not already running) and opens your browser.

cd "$(dirname "$0")" || exit 1

URL="http://localhost:3000"

# Make sure Node is findable even when launched from Finder (which uses a
# minimal PATH). Cover Homebrew (Apple Silicon + Intel) and nvm.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

# If the server is already up, just open the browser and quit.
if curl -s -o /dev/null "$URL"; then
  open "$URL"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install it from https://nodejs.org (LTS), then try again."
  echo "Press any key to close this window."
  read -r -n 1
  exit 1
fi

echo "Starting Kurs BCA…"
node server.js &
SERVER_PID=$!

# Wait for the server to answer, then open the browser.
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$URL"; then break; fi
  sleep 0.3
done
open "$URL"

echo ""
echo "Kurs BCA is running at $URL"
echo "Keep this window open while you use the app."
echo "To stop it: close this window, or press Ctrl+C."

# Stop the server if this window is closed / interrupted.
trap 'kill $SERVER_PID 2>/dev/null' EXIT
wait $SERVER_PID
