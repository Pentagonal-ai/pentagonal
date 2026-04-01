#!/bin/bash
# Build the Pentagonal Skill ZIP package for Claude.ai upload
# Usage: ./build-skill-zip.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/skill"
OUTPUT_DIR="$SCRIPT_DIR/dist"
ZIP_NAME="pentagonal-skill.zip"

echo "🔷 Building Pentagonal Skill ZIP..."

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Remove old ZIP if it exists
rm -f "$OUTPUT_DIR/$ZIP_NAME"

# Create a temporary staging directory
STAGING=$(mktemp -d)
mkdir -p "$STAGING/pentagonal"

# Copy skill files into the staging folder
cp "$SKILL_DIR/SKILL.md" "$STAGING/pentagonal/"
cp -r "$SKILL_DIR/references" "$STAGING/pentagonal/"

# Create the ZIP from the staging directory
cd "$STAGING"
zip -r "$OUTPUT_DIR/$ZIP_NAME" pentagonal/

# Cleanup
rm -rf "$STAGING"

echo "✅ Built: $OUTPUT_DIR/$ZIP_NAME"
echo ""
echo "Upload this ZIP to Claude.ai:"
echo "  Settings → Customize → Skills → + → Upload a skill"
echo ""
echo "Or place the 'pentagonal/' folder in:"
echo "  Claude Code: ~/.claude/skills/pentagonal/"
echo "  Claude Code (project): .claude/skills/pentagonal/"
