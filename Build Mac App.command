#!/bin/bash
# Run this ONCE (double-click in Finder) to build a real "Kurs BCA.app".
# The resulting app launches the server in the background and opens your
# browser with NO visible terminal window. Keep it in your Dock.

cd "$(dirname "$0")" || exit 1
REPO="$(pwd)"

# Find Node even under Finder's minimal PATH (Homebrew Apple Silicon/Intel, nvm).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

NODE="$(command -v node)"
if [ -z "$NODE" ]; then
  echo "Node.js was not found. Install it from https://nodejs.org (LTS), then run this again."
  echo "Press any key to close this window."
  read -r -n 1
  exit 1
fi

echo "Using Node at: $NODE"
echo "Project folder: $REPO"

# Pick a writable place to put the app: /Applications, else ~/Applications, else here.
DEST=""
for d in "/Applications" "$HOME/Applications" "$REPO"; do
  mkdir -p "$d" 2>/dev/null
  if [ -w "$d" ]; then DEST="$d"; break; fi
done
APP="$DEST/Kurs BCA.app"

# Build the AppleScript source with the real paths baked in.
SRC="$(mktemp -t kursbca).applescript"
cat > "$SRC" <<APPLESCRIPT
on run
	set repo to "$REPO"
	set nodeBin to "$NODE"
	set theURL to "http://localhost:3000"
	set isUp to false
	try
		do shell script "/usr/bin/curl -s -o /dev/null " & theURL
		set isUp to true
	end try
	if not isUp then
		do shell script "cd " & quoted form of repo & " && nohup " & quoted form of nodeBin & " server.js >/dev/null 2>&1 </dev/null &"
		delay 1.5
	end if
	do shell script "/usr/bin/open " & theURL
end run
APPLESCRIPT

rm -rf "$APP" 2>/dev/null
if osacompile -o "$APP" "$SRC"; then
  rm -f "$SRC"
  echo ""
  echo "Built: $APP"
  echo "Opening its folder so you can drag it to the Dock…"
  open -R "$APP"
  echo "Done. Double-click 'Kurs BCA' to launch (no terminal window)."
else
  rm -f "$SRC"
  echo "Failed to build the app."
fi

echo ""
echo "Press any key to close this window."
read -r -n 1
