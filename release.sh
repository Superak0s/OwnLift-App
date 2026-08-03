#!/bin/bash
set -e

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== OwnLift App Release Script (Linux Native Build) ==="

sleep 2

# ─── [0/5] Version Bump ───────────────────────────────────────────────────────
echo ""
echo "[0/5] Version management..."

CURRENT_VERSION=$(node -e "console.log(require('$PROJECT/package.json').version)")
IFS='.' read -r CUR_MAJOR CUR_MINOR CUR_PATCH <<< "$CURRENT_VERSION"
AUTO_PATCH_VERSION="$CUR_MAJOR.$CUR_MINOR.$((CUR_PATCH + 1))"
AUTO_MINOR_VERSION="$CUR_MAJOR.$((CUR_MINOR + 1)).0"

echo "Current version: $CURRENT_VERSION"
echo ""
echo "[1] Increment patch to $AUTO_PATCH_VERSION"
echo "[2] Increment minor to $AUTO_MINOR_VERSION (resets patch to 0)"
echo "[3] Enter custom version"
echo "[4] Keep current version ($CURRENT_VERSION)"
echo ""
read -rp "Choose (1-4, default=1): " VERSION_CHOICE
VERSION_CHOICE="${VERSION_CHOICE:-1}"

case "$VERSION_CHOICE" in
    2)
        NEW_VERSION="$AUTO_MINOR_VERSION"
        ;;
    3)
        read -rp "Enter custom version (e.g. 2.0.0): " NEW_VERSION
        if [ -z "$NEW_VERSION" ]; then
            echo "ERROR: No version entered."
            exit 1
        fi
        ;;
    4)
        NEW_VERSION="$CURRENT_VERSION"
        ;;
    *)
        NEW_VERSION="$AUTO_PATCH_VERSION"
        ;;
esac

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

echo "Version updated to $NEW_VERSION"

# ─── [1/5] Push source to GitHub ─────────────────────────────────────────────
echo ""
echo "[1/5] Pushing source code to GitHub..."
cd "$PROJECT"
git add .

if git diff --quiet && git diff --cached --quiet; then
    echo "Nothing to commit, skipping push."
else
    read -rp "Enter commit message (or press Enter for default): " COMMIT_MSG
    COMMIT_MSG="${COMMIT_MSG:-Release v$NEW_VERSION}"
    git commit -m "$COMMIT_MSG"
    git push origin main
fi

# ─── [2/5] Clear Metro cache ──────────────────────────────────────────────────
echo ""
echo "[2/5] Clearing Metro cache..."
rm -rf /tmp/metro-cache 2>/dev/null || true
rm -rf "$PROJECT/.expo" 2>/dev/null || true

# ─── [3/5] Install dependencies and run prebuild ─────────────────────────────
echo ""
echo "[3/5] Installing dependencies and running prebuild..."
cd "$PROJECT"

# Skip npm install if package.json hasn't changed and node_modules exists
PKG_HASH=$(md5sum "$PROJECT/package.json" | cut -d' ' -f1)
LOCK_CHANGED=false
if [ -f "$PROJECT/.last_pkg_hash" ]; then
    LAST_HASH=$(cat "$PROJECT/.last_pkg_hash")
    [ "$PKG_HASH" != "$LAST_HASH" ] && LOCK_CHANGED=true
else
    LOCK_CHANGED=true
fi

if [ "$LOCK_CHANGED" = true ] || [ ! -d "$PROJECT/node_modules" ]; then
    echo "Dependencies changed or missing — running npm install..."
    npm install --legacy-peer-deps
    echo "$PKG_HASH" > "$PROJECT/.last_pkg_hash"
else
    echo "package.json unchanged — skipping npm install."
fi

npx expo prebuild --platform android --clean

# ─── Tune gradle.properties ───────────────────────────────────────────────────
GRADLE_PROPS="$PROJECT/android/gradle.properties"

sed -i 's/org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx12g -Xms4g -XX:MaxMetaspaceSize=2g -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200/' "$GRADLE_PROPS"

grep -qxF 'org.gradle.parallel=true'          "$GRADLE_PROPS" || echo 'org.gradle.parallel=true'          >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.caching=true'           "$GRADLE_PROPS" || echo 'org.gradle.caching=true'           >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.configureondemand=true' "$GRADLE_PROPS" || echo 'org.gradle.configureondemand=true' >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.daemon=true'            "$GRADLE_PROPS" || echo 'org.gradle.daemon=true'            >> "$GRADLE_PROPS"
grep -qxF 'kotlin.incremental=true'           "$GRADLE_PROPS" || echo 'kotlin.incremental=true'           >> "$GRADLE_PROPS"
grep -qxF 'kotlin.daemon.jvm.options=-Xmx4g'  "$GRADLE_PROPS" || echo 'kotlin.daemon.jvm.options=-Xmx4g'  >> "$GRADLE_PROPS"
grep -qxF 'android.enableR8.fullMode=false'   "$GRADLE_PROPS" || echo 'android.enableR8.fullMode=false'   >> "$GRADLE_PROPS"
# Remove deprecated android.enableBuildCache if present (removed in AGP 7.0)
sed -i '/^android\.enableBuildCache/d' "$GRADLE_PROPS"

# ─── [3b/5] Inject signing config ─────────────────────────────────────────────
echo ""
echo "[3b/5] Injecting signing config..."

# Load secrets
source ~/.ownlift-secrets

GRADLE_APP="$PROJECT/android/app/build.gradle"

# Write keystore.properties
cat > "$PROJECT/android/keystore.properties" <<PROPS
storeFile=$KEYSTORE_PATH
storePassword=$KEYSTORE_PASS
keyAlias=$KEY_ALIAS
keyPassword=$KEY_PASS
PROPS

# Inject into build.gradle
python3 << PYEOF
import re, os

gradle_path = "$GRADLE_APP"

with open(gradle_path, "r") as f:
    content = f.read()

# Signing config block
signing_block = '''
    signingConfigs {
        release {
            def props = new Properties()
            def propsFile = rootProject.file("keystore.properties")
            if (propsFile.exists()) { props.load(new FileInputStream(propsFile)) }
            storeFile     file(props['storeFile'])
            storePassword props['storePassword']
            keyAlias      props['keyAlias']
            keyPassword   props['keyPassword']
        }
    }
'''

# Insert signingConfigs before buildTypes
content = re.sub(
    r'(\s*buildTypes\s*\{)',
    signing_block + r'\1',
    content, count=1
)

# Add signingConfig inside release buildType
content = re.sub(
    r'(release\s*\{[^}]*?)(minifyEnabled)',
    r'\1signingConfig signingConfigs.release\n            \2',
    content, count=1, flags=re.DOTALL
)

with open(gradle_path, "w") as f:
    f.write(content)

print("Done.")
PYEOF

echo "Signing config injected."

# ─── [4/5] Build the APK ──────────────────────────────────────────────────────
echo ""
echo "[4/5] Building release APK..."
cd "$PROJECT/android"

# Unset GRADLE_OPTS so gradle.properties values take full effect
unset GRADLE_OPTS

./gradlew assembleRelease \
    --build-cache \
    --parallel \
    --daemon \
    -Dfile.encoding=UTF-8

APK_SRC="$PROJECT/android/app/build/outputs/apk/release/app-release.apk"
APK_DEST="$PROJECT/app-release.apk"

if [ ! -f "$APK_SRC" ]; then
    echo "ERROR: APK not found at $APK_SRC"
    exit 1
fi

cp "$APK_SRC" "$APK_DEST"
echo "APK size: $(du -sh "$APK_DEST" | cut -f1)"
echo "APK built at: $APK_DEST"

# ─── [5/5] Push to GitHub Releases ───────────────────────────────────────────
echo ""
echo "[5/5] Creating GitHub release..."
cd "$PROJECT"

VERSION=$(node -e "console.log(require('./app.json').expo.version)")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG="v${VERSION}-${TIMESTAMP}"

gh release create "$TAG" "$APK_DEST" \
    --title "OwnLift v$VERSION" \
    --notes "Release v$VERSION built on $TIMESTAMP"

echo ""
echo "=== Done! APK released as $TAG ==="