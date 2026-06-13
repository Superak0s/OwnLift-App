#!/bin/bash
set -e

# ─── WSL-Safe Project Setup ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIN_PROJECT="$SCRIPT_DIR"
WSL_PROJECT="$HOME/SuperGym-App"

echo "=== SuperGym App Release Script (WSL Build) ==="
echo ""
sleep 1

# ─── [0/6] Sync project to WSL native filesystem ─────────────────────────────
echo "[0/6] Syncing project to WSL native filesystem..."
echo "      From: $WIN_PROJECT"
echo "      To:   $WSL_PROJECT"

rsync -a --delete --checksum \
  --exclude='node_modules' \
  --exclude='android' \
  --exclude='.expo' \
  --exclude='*.apk' \
  "$WIN_PROJECT/" "$WSL_PROJECT/"

echo "Sync complete."

# Work entirely from WSL native path from here on
cd "$WSL_PROJECT"

# ─── [1/6] Version Bump ───────────────────────────────────────────────────────
echo ""
echo "[1/6] Version management..."

CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
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
const p = require('./package.json');
p.version = '$NEW_VERSION';
fs.writeFileSync('./package.json', JSON.stringify(p, null, 2) + '\n');
"

node -e "
const fs = require('fs');
const a = require('./app.json');
a.expo.version = '$NEW_VERSION';
fs.writeFileSync('./app.json', JSON.stringify(a, null, 2) + '\n');
"

echo "Version updated to $NEW_VERSION"

# ─── [2/6] Sync version bump back to Windows source ──────────────────────────
echo ""
echo "[2/6] Syncing version bump back to Windows source..."
cp "$WSL_PROJECT/package.json" "$WIN_PROJECT/package.json"
cp "$WSL_PROJECT/app.json" "$WIN_PROJECT/app.json"
echo "Done."

# ─── [3/6] Push source to GitHub (from Windows path for git) ─────────────────
echo ""
echo "[3/6] Pushing source code to GitHub..."
cd "$WIN_PROJECT"
git add .

if git diff --quiet && git diff --cached --quiet; then
    echo "Nothing to commit, skipping push."
else
    read -rp "Enter commit message (or press Enter for default): " COMMIT_MSG
    COMMIT_MSG="${COMMIT_MSG:-Release v$NEW_VERSION}"
    git commit -m "$COMMIT_MSG"
    git push origin main
fi

# ─── [4/6] Install dependencies and prebuild (WSL native) ────────────────────
echo ""
echo "[4/6] Installing dependencies and running prebuild..."
cd "$WSL_PROJECT"

# Skip npm install if package.json hasn't changed and node_modules exists
PKG_HASH_WIN=$(md5sum "$WIN_PROJECT/package.json" | cut -d' ' -f1)
PKG_HASH_WSL=$(md5sum "$WSL_PROJECT/package.json" | cut -d' ' -f1)
LOCK_CHANGED=false
if [ -f "$WSL_PROJECT/.last_pkg_hash" ]; then
    LAST_HASH=$(cat "$WSL_PROJECT/.last_pkg_hash")
    [ "$PKG_HASH_WSL" != "$LAST_HASH" ] && LOCK_CHANGED=true
else
    LOCK_CHANGED=true
fi

if [ "$LOCK_CHANGED" = true ] || [ ! -d "$WSL_PROJECT/node_modules" ]; then
    echo "Dependencies changed or missing — running npm install..."
    npm install --legacy-peer-deps
    echo "$PKG_HASH_WSL" > "$WSL_PROJECT/.last_pkg_hash"
else
    echo "package.json unchanged — skipping npm install."
fi

# Ask whether to do a clean prebuild
read -rp "Full prebuild with --clean? Needed after adding native deps (y/N): " DO_CLEAN
DO_CLEAN="${DO_CLEAN:-n}"
if [ "${DO_CLEAN,,}" = "y" ]; then
    echo "Running full clean prebuild..."
    npx expo prebuild --platform android --clean
else
    echo "Running incremental prebuild..."
    npx expo prebuild --platform android
fi

# ─── Tune gradle.properties for 32GB RAM ──────────────────────────────────────
GRADLE_PROPS="$WSL_PROJECT/android/gradle.properties"

# JVM heap — 12GB gives Gradle plenty of room without starving the OS
sed -i 's/org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx12g -Xms4g -XX:MaxMetaspaceSize=2g -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200/' "$GRADLE_PROPS"

grep -qxF 'org.gradle.parallel=true'             "$GRADLE_PROPS" || echo 'org.gradle.parallel=true'             >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.caching=true'              "$GRADLE_PROPS" || echo 'org.gradle.caching=true'              >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.configureondemand=true'    "$GRADLE_PROPS" || echo 'org.gradle.configureondemand=true'    >> "$GRADLE_PROPS"
grep -qxF 'org.gradle.daemon=true'               "$GRADLE_PROPS" || echo 'org.gradle.daemon=true'               >> "$GRADLE_PROPS"
grep -qxF 'kotlin.incremental=true'              "$GRADLE_PROPS" || echo 'kotlin.incremental=true'              >> "$GRADLE_PROPS"
grep -qxF 'kotlin.daemon.jvm.options=-Xmx4g'    "$GRADLE_PROPS" || echo 'kotlin.daemon.jvm.options=-Xmx4g'    >> "$GRADLE_PROPS"
grep -qxF 'android.enableR8.fullMode=false'      "$GRADLE_PROPS" || echo 'android.enableR8.fullMode=false'      >> "$GRADLE_PROPS"
# Remove deprecated android.enableBuildCache if present (removed in AGP 7.0)
sed -i '/^android\.enableBuildCache/d' "$GRADLE_PROPS"

# ─── [4b] Inject signing config ───────────────────────────────────────────────
echo ""
echo "[4b] Injecting signing config..."

# Load secrets
source ~/.supergym-secrets

GRADLE_APP="$WSL_PROJECT/android/app/build.gradle"

# Write keystore.properties
cat > "$WSL_PROJECT/android/keystore.properties" <<PROPS
storeFile=$KEYSTORE_PATH
storePassword=$KEYSTORE_PASS
keyAlias=$KEY_ALIAS
keyPassword=$KEY_PASS
PROPS

# Inject into build.gradle
python3 << 'PYEOF'
import re, os

gradle_path = os.path.expanduser("~/SuperGym-App/android/app/build.gradle")

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

# ─── [5/6] Build the APK (WSL native) ────────────────────────────────────────
echo ""
echo "[5/6] Building release APK..."
cd "$WSL_PROJECT/android"

# Unset GRADLE_OPTS so gradle.properties values take full effect
unset GRADLE_OPTS

./gradlew assembleRelease \
    --build-cache \
    --parallel \
    --daemon \
    -Dfile.encoding=UTF-8

APK_SRC="$WSL_PROJECT/android/app/build/outputs/apk/release/app-release.apk"
APK_WSL="$WSL_PROJECT/app-release.apk"
APK_WIN="$WIN_PROJECT/app-release.apk"

if [ ! -f "$APK_SRC" ]; then
    echo "ERROR: APK not found at $APK_SRC"
    exit 1
fi

cp "$APK_SRC" "$APK_WSL"
cp "$APK_SRC" "$APK_WIN"
echo "APK size: $(du -sh "$APK_WSL" | cut -f1)"
echo "APK copied to WSL:     $APK_WSL"
echo "APK copied to Windows: $APK_WIN"

# ─── [6/6] Push to GitHub Releases ───────────────────────────────────────────
echo ""
echo "[6/6] Creating GitHub release..."
cd "$WIN_PROJECT"

VERSION=$(node -e "console.log(require('./app.json').expo.version)")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG="v${VERSION}-${TIMESTAMP}"

gh release create "$TAG" "$APK_WIN" \
    --title "SuperGym v$VERSION" \
    --notes "Release v$VERSION built on $TIMESTAMP"

echo ""
echo "=== Done! APK released as $TAG ==="