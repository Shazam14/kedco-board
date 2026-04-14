#!/bin/sh
# Installs git hooks from scripts/ into .git/hooks/
# Run once after cloning: sh scripts/install-hooks.sh

HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="scripts"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Error: .git/hooks not found. Are you in the project root?"
  exit 1
fi

cp "$SCRIPTS_DIR/pre-push" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"

echo "✓ pre-push hook installed — E2E tests will run before every push."
