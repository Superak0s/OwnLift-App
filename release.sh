#!/bin/bash
set -e

PROJECT="$HOME/Documents/Coding/SuperGym/SuperGym-App"

echo "=== SuperGym App Release Script (Linux Native Build) ==="

sleep 2

# ─── [0/5] Version Bump ───────────────────────────────────────────────────────
echo ""
echo "[0/5] Version management..."

CURRENT_VERSION=$(node -e "console.log(require('$PROJECT/package.json').version)")
AUTO_VERSION=$(node -e "const v='$CURRENT_VERSION'.split('.'); v[2]=parseInt(v[2])+1; console.log(v.join('.'))")

echo "Current version: $CURRENT_VERSION"
echo ""
echo "[1] Auto-increment to $AUTO_VERSION"
echo "[2] Enter custom version"
echo ""
read -rp "Choose (1 or 2, default=1): " VERSION_CHOICE
VERSION_CHOICE="${VERSION_CHOICE:-1}"

if [ "$VERSION_CHOICE" = "2" ]; then
    read -rp "Enter custom version (e.g. 2.0.0): " NEW_VERSION
    if [ -z "$NEW_VERSION" ]; then
        echo "ERROR: No version entered."
        exit 1
    fi
else
    NEW_VERSION="$AUTO_VERSION"
fi

echo "Updating version to: $NEW_VERSION"

node -e "
const fs = require('fs');
const p = require('$PROJECT/package.json');
p.version = '$NEW_VERSION';
fs.writeFileSync('$PROJECT/package.json', JSON.stringify(p, null, 2) + '\n');
"

node -e "
const fs = require('fs');
const a = require('$PROJECT/app.json');
a.expo.version = '$NEW_VERSION';
fs.writeFileSync('$PROJECT/app.json', JSON.stringify(a, null, 2) + '\n');
"

echo "Version updated successfully!"

# ─── [1/5] Push source to GitHub ─────────────────────────────────────────────
echo ""
echo "[1/5] Pushing source code to GitHub..."
cd "$PROJECT"
git add .
read -rp "Enter commit message (or press Enter for default): " COMMIT_MSG
COMMIT_MSG="${COMMIT_MSG:-Release update}"
git commit -m "$COMMIT_MSG"
git push origin main

# ─── [2/5] Clear Metro cache ──────────────────────────────────────────────────
echo ""
echo "[2/5] Clearing Metro cache..."
rm -rf /tmp/metro-cache 2>/dev/null || true
rm -rf "$PROJECT/.expo" 2>/dev/null || true

# ─── [3/5] Install dependencies and run prebuild ─────────────────────────────
echo ""
echo "[3/5] Installing dependencies and running prebuild..."
cd "$PROJECT"
npm install --legacy-peer-deps

npx expo prebuild --platform android --clean

# Tune gradle.properties for performance
GRADLE_PROPS="$PROJECT/android/gradle.properties"
sed -i 's/org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g/' "$GRADLE_PROPS"

# Add performance flags if not already present
grep -qxF 'org.gradle.parallel=true' "$GRADLE_PROPS" || echo 'org.gradle.parallel=true' >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.caching=true' "$GRADLE_PROPS" || echo 'org.gradle.caching=true' >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.configureondemand=true' "$GRADLE_PROPS" || echo 'org.gradle.configureondemand=true' >> "$GRADLE_PROPS"

# ─── [4/5] Build the APK ──────────────────────────────────────────────────────
echo ""
echo "[4/5] Building release APK..."
cd "$PROJECT/android"
export GRADLE_OPTS="-Xmx6g -XX:MaxMetaspaceSize=2g"
./gradlew assembleRelease

APK_SRC="$PROJECT/android/app/build/outputs/apk/release/app-release.apk"
APK_DEST="$PROJECT/app-release.apk"

if [ ! -f "$APK_SRC" ]; then
    echo "ERROR: APK not found at $APK_SRC"
    exit 1
fi

cp "$APK_SRC" "$APK_DEST"
echo "APK built at: $APK_DEST"

# ─── [5/5] Push to GitHub Releases ───────────────────────────────────────────
echo ""
echo "[5/5] Creating GitHub release..."
cd "$PROJECT"

VERSION=$(node -e "console.log(require('./app.json').expo.version)")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG="v${VERSION}-${TIMESTAMP}"

gh release create "$TAG" "$APK_DEST" \
    --title "SuperGym v$VERSION" \
    --notes "Release v$VERSION built $TIMESTAMP"

echo ""
echo "=== Done! APK released as $TAG ==="