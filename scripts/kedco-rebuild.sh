#!/usr/bin/bash
# Rebuild the Next.js test server and restart the systemd service.
# Called by the pre-push hook when code has changed since last build.

export PATH="/root/.nvm/versions/node/v22.22.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
NODE="/root/.nvm/versions/node/v22.22.2/bin/node"
DIR="/root/projects/website"

echo "Stopping kedco-test-server..."
/usr/bin/systemctl stop kedco-test-server 2>/dev/null || true

echo "Clearing .next cache..."
$NODE -e "
const fs = require('fs');
try { fs.rmSync('$DIR/.next', { recursive: true, force: true }); } catch(e) {}
" 2>/dev/null || true

echo "Building Next.js..."
cd "$DIR"
API_URL=http://localhost:9999 AUTH_COOKIE=kedco_token $NODE node_modules/.bin/next build
BUILD_STATUS=$?

if [ $BUILD_STATUS -ne 0 ]; then
  echo "Build failed."
  exit 1
fi

# Record the commit SHA so the hook knows this build is fresh
git rev-parse HEAD > "$DIR/.next/last-build-commit" 2>/dev/null || true

echo "Starting kedco-test-server..."
/usr/bin/systemctl start kedco-test-server

# Wait up to 30s for port 3001 to be ready
for i in $(seq 1 15); do
  if /usr/bin/ss -tlnp | /usr/bin/grep -q ':3001 '; then
    echo "Test server ready."
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for test server on port 3001."
exit 1
