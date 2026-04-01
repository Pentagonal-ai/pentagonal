#!/bin/bash
# Build the Pentagonal Clawd Skill ZIP package for Claude.ai upload
# Usage: ./build-skill-zip.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/skill"
OUTPUT_DIR="$SCRIPT_DIR/dist"
ZIP_NAME="pentagonal-clawd-skill.zip"

echo "🔷 Building Pentagonal Clawd Skill ZIP..."

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Remove old ZIPs if they exist
rm -f "$OUTPUT_DIR/$ZIP_NAME"
rm -f "$OUTPUT_DIR/pentagonal-skill.zip"

# Create a temporary staging directory
STAGING=$(mktemp -d)
mkdir -p "$STAGING/pentagonal-clawd"

# Copy skill files into the staging folder
cp "$SKILL_DIR/SKILL.md" "$STAGING/pentagonal-clawd/"
cp -r "$SKILL_DIR/references" "$STAGING/pentagonal-clawd/"

# Create the ZIP from the staging directory
cd "$STAGING"
zip -r "$OUTPUT_DIR/$ZIP_NAME" pentagonal-clawd/

# Cleanup
rm -rf "$STAGING"

echo "✅ Built: $OUTPUT_DIR/$ZIP_NAME"
echo ""
echo "Upload this ZIP to Claude.ai:"
echo "  Settings → Customize → Skills → + → Upload a skill"
echo ""
echo "Or place the 'pentagonal-clawd/' folder in:"
echo "  Claude Code: ~/.claude/skills/pentagonal-clawd/"
echo "  Claude Code (project): .claude/skills/pentagonal-clawd/"
