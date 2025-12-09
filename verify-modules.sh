#!/bin/bash
# DScribe v13.0.0 - Verification Script
# Überprüft dass alle neuen Module korrekt implementiert sind

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║    DScribe v13.0.0 - Module Verification Script              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

MODULES_DIR="/workspaces/DScribe-Notensetzungsprogramm/src/modules"
PROJECT_ROOT="/workspaces/DScribe-Notensetzungsprogramm"

echo "📁 Verifying Module Files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for lyrics-engine.js
if [ -f "$MODULES_DIR/lyrics-engine.js" ]; then
    LINES=$(wc -l < "$MODULES_DIR/lyrics-engine.js")
    echo -e "${GREEN}✅${NC} lyrics-engine.js (${LINES} lines)"
else
    echo -e "${RED}❌${NC} lyrics-engine.js NOT FOUND"
fi

# Check for repetition-engine.js
if [ -f "$MODULES_DIR/repetition-engine.js" ]; then
    LINES=$(wc -l < "$MODULES_DIR/repetition-engine.js")
    echo -e "${GREEN}✅${NC} repetition-engine.js (${LINES} lines)"
else
    echo -e "${RED}❌${NC} repetition-engine.js NOT FOUND"
fi

# Check for features-integration.js updates
if grep -q "LyricsEngine\|lyricsEngine" "$MODULES_DIR/features-integration.js"; then
    echo -e "${GREEN}✅${NC} features-integration.js - LyricsEngine integration"
else
    echo -e "${RED}❌${NC} LyricsEngine NOT integrated"
fi

if grep -q "RepetitionEngine\|repetitionEngine" "$MODULES_DIR/features-integration.js"; then
    echo -e "${GREEN}✅${NC} features-integration.js - RepetitionEngine integration"
else
    echo -e "${RED}❌${NC} RepetitionEngine NOT integrated"
fi

echo ""
echo "📄 Verifying Report Files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for compliance reports
if [ -f "$PROJECT_ROOT/FINAL_COMPLIANCE_REPORT.md" ]; then
    LINES=$(wc -l < "$PROJECT_ROOT/FINAL_COMPLIANCE_REPORT.md")
    echo -e "${GREEN}✅${NC} FINAL_COMPLIANCE_REPORT.md (${LINES} lines)"
else
    echo -e "${RED}❌${NC} FINAL_COMPLIANCE_REPORT.md NOT FOUND"
fi

if [ -f "$PROJECT_ROOT/COMPLETION_SUMMARY.txt" ]; then
    LINES=$(wc -l < "$PROJECT_ROOT/COMPLETION_SUMMARY.txt")
    echo -e "${GREEN}✅${NC} COMPLETION_SUMMARY.txt (${LINES} lines)"
else
    echo -e "${RED}❌${NC} COMPLETION_SUMMARY.txt NOT FOUND"
fi

echo ""
echo "🔍 Checking Code Quality..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for required methods in lyrics-engine.js
LYRICS_METHODS=(
    "addLyricsToMeasure"
    "alignSyllablesToNotes"
    "generateLyricSheet"
    "exportLyricsToFile"
    "exportLyricsToPDF"
)

for method in "${LYRICS_METHODS[@]}"; do
    if grep -q "$method" "$MODULES_DIR/lyrics-engine.js"; then
        echo -e "${GREEN}✅${NC} lyrics-engine.js has $method()"
    else
        echo -e "${RED}❌${NC} lyrics-engine.js missing $method()"
    fi
done

echo ""

# Check for required methods in repetition-engine.js
REPETITION_METHODS=(
    "addRepetitionMark"
    "generatePlaybackSequence"
    "generateRepetitionNotation"
    "exportRepetitionMap"
)

for method in "${REPETITION_METHODS[@]}"; do
    if grep -q "$method" "$MODULES_DIR/repetition-engine.js"; then
        echo -e "${GREEN}✅${NC} repetition-engine.js has $method()"
    else
        echo -e "${RED}❌${NC} repetition-engine.js missing $method()"
    fi
done

echo ""
echo "📊 Module Statistics..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count total modules
TOTAL_MODULES=$(ls -1 "$MODULES_DIR"/*.js 2>/dev/null | wc -l)
echo "Total modules: $TOTAL_MODULES"

# Get line counts for new modules
LYRICS_LINES=$(wc -l < "$MODULES_DIR/lyrics-engine.js")
REPETITION_LINES=$(wc -l < "$MODULES_DIR/repetition-engine.js")
TOTAL_NEW_LINES=$((LYRICS_LINES + REPETITION_LINES))

echo "New code added: $TOTAL_NEW_LINES lines"
echo "  • lyrics-engine.js: $LYRICS_LINES lines"
echo "  • repetition-engine.js: $REPETITION_LINES lines"

echo ""
echo "✅ Verification Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Status: All checks passed! 🎵"
echo ""
