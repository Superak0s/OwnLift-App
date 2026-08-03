@echo off
setlocal enabledelayedexpansion

set PROJECT=C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App
set DOCKER_IMAGE=ownlift-builder
set DOCKER_CONTAINER=sg-build
set SECRETS_FILE=%USERPROFILE%\.ownlift-secrets.bat

echo === OwnLift App Release Script (Docker Build) ===

taskkill /f /im java.exe   >nul 2>&1
taskkill /f /im gradle.exe >nul 2>&1
taskkill /f /im node.exe   >nul 2>&1
taskkill /f /im adb.exe    >nul 2>&1
timeout /t 3 /nobreak >nul

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running.
    pause & exit /b 1
)

:: ─── [0/6] Version Bump ───────────────────────────────────────────────────────
echo.
echo [0/6] Version management...

for /f "delims=" %%i in ('node -e "console.log(require('%PROJECT:\=\\%/package.json').version)"') do set CURRENT_VERSION=%%i

for /f "tokens=1,2,3 delims=." %%a in ("%CURRENT_VERSION%") do (
    set CUR_MAJOR=%%a
    set CUR_MINOR=%%b
    set CUR_PATCH=%%c
)
set /a AUTO_PATCH_PATCH=%CUR_PATCH%+1
set AUTO_PATCH_VERSION=%CUR_MAJOR%.%CUR_MINOR%.%AUTO_PATCH_PATCH%
set /a AUTO_MINOR_MINOR=%CUR_MINOR%+1
set AUTO_MINOR_VERSION=%CUR_MAJOR%.%AUTO_MINOR_MINOR%.0

echo Current version: %CURRENT_VERSION%
echo.
echo [1] Increment patch to %AUTO_PATCH_VERSION%
echo [2] Increment minor to %AUTO_MINOR_VERSION% (resets patch to 0)
echo [3] Enter custom version
echo [4] Keep current version (%CURRENT_VERSION%)
echo.
set /p VERSION_CHOICE="Choose (1-4, default=1): "
if "%VERSION_CHOICE%"=="" set VERSION_CHOICE=1

if "%VERSION_CHOICE%"=="2" (
    set NEW_VERSION=%AUTO_MINOR_VERSION%
) else if "%VERSION_CHOICE%"=="3" (
    set /p NEW_VERSION="Enter custom version (e.g. 2.0.0): "
    if "!NEW_VERSION!"=="" (
        echo ERROR: No version entered.
        pause & exit /b 1
    )
) else if "%VERSION_CHOICE%"=="4" (
    set NEW_VERSION=%CURRENT_VERSION%
) else (
    set NEW_VERSION=%AUTO_PATCH_VERSION%
)

echo Updating version to: !NEW_VERSION!

node -e "const fs=require('fs'); const p=require('%PROJECT:\=\\%/package.json'); p.version='!NEW_VERSION!'; fs.writeFileSync('%PROJECT:\=\\%/package.json', JSON.stringify(p, null, 2)+'\n')"
node -e "const fs=require('fs'); const a=require('%PROJECT:\=\\%/app.json'); a.expo.version='!NEW_VERSION!'; fs.writeFileSync('%PROJECT:\=\\%/app.json', JSON.stringify(a, null, 2)+'\n')"

echo Version updated to !NEW_VERSION!

:: ─── [1/6] Push source to GitHub ─────────────────────────────────────────────
echo.
echo [1/6] Pushing source code to GitHub...
cd /d "%PROJECT%"
git add .

git diff --quiet --exit-code
set DIFF1=%errorlevel%
git diff --cached --quiet --exit-code
set DIFF2=%errorlevel%

if %DIFF1%==0 if %DIFF2%==0 (
    echo Nothing to commit, skipping push.
) else (
    set /p COMMIT_MSG="Enter commit message (or press Enter for default): "
    if "!COMMIT_MSG!"=="" set COMMIT_MSG=Release v!NEW_VERSION!
    git commit -m "!COMMIT_MSG!"
    git push origin main
)

:: ─── [2/6] Clear Metro cache ──────────────────────────────────────────────────
echo.
echo [2/6] Clearing Metro cache...
if exist "%TEMP%\metro-cache" rmdir /s /q "%TEMP%\metro-cache"

:: ─── [3/6] Load signing secrets and stage keystore for the build context ─────
echo.
echo [3/6] Loading signing secrets...

if not exist "%SECRETS_FILE%" (
    echo ERROR: Secrets file not found at %SECRETS_FILE%
    echo         It must SET KEYSTORE_PATH, KEYSTORE_PASS, KEY_ALIAS, KEY_PASS
    pause & exit /b 1
)
call "%SECRETS_FILE%"

if not exist "%KEYSTORE_PATH%" (
    echo ERROR: Keystore not found at %KEYSTORE_PATH%
    pause & exit /b 1
)

if not exist "%PROJECT%\docker-signing" mkdir "%PROJECT%\docker-signing"
copy /y "%KEYSTORE_PATH%" "%PROJECT%\docker-signing\release.keystore" >nul

powershell -NoProfile -Command "$p = @(\"storeFile=docker-signing/release.keystore\", \"storePassword=%KEYSTORE_PASS%\", \"keyAlias=%KEY_ALIAS%\", \"keyPassword=%KEY_PASS%\"); $p -join \"`n\" | Set-Content -Path '%PROJECT%\keystore.properties' -Encoding UTF8"

echo Signing materials staged.
echo NOTE: keystore.properties and docker-signing\ contain secrets - make sure
echo       they're listed in .gitignore so they never get committed.

:: ─── [4/6] Write Dockerfile, signing-injector, and .dockerignore ─────────────
echo.
echo [4/6] Writing Dockerfile...

powershell -NoProfile -Command "$ignore = \"node_modules`nandroid`n.git`n*.log`n.expo`nios`n\"; Set-Content -Path '%PROJECT%\.dockerignore' -Value $ignore -Encoding UTF8;"

powershell -NoProfile -Command "$py = @(\"import re\", \"\", \"gradle_path = '/app/android/app/build.gradle'\", \"\", \"with open(gradle_path, 'r') as f:\", \"    content = f.read()\", \"\", \"signing_block = '''\", \"    signingConfigs {\", \"        release {\", \"            def props = new Properties()\", \"            def propsFile = rootProject.file(\\\"keystore.properties\\\")\", \"            if (propsFile.exists()) { props.load(new FileInputStream(propsFile)) }\", \"            storeFile     file(props['storeFile'])\", \"            storePassword props['storePassword']\", \"            keyAlias      props['keyAlias']\", \"            keyPassword   props['keyPassword']\", \"        }\", \"    }\", \"'''\", \"\", \"content = re.sub(\", \"    r'(\\s*buildTypes\\s*\\{)',\", \"    signing_block + r'\\1',\", \"    content, count=1\", \")\", \"\", \"content = re.sub(\", \"    r'(release\\s*\\{[^}]*?)(minifyEnabled)',\", \"    r'\\1signingConfig signingConfigs.release\\n            \\2',\", \"    content, count=1, flags=re.DOTALL\", \")\", \"\", \"with open(gradle_path, 'w') as f:\", \"    f.write(content)\", \"\", \"print('Signing config injected.')\"); $py -join \"`n\" | Set-Content -Path '%PROJECT%\inject_signing.py' -Encoding UTF8"

powershell -NoProfile -Command "$d = @(\"FROM reactnativecommunity/react-native-android:latest\", \"\", \"ENV NODE_ENV=production\", \"\", \"WORKDIR /app\", \"\", \"COPY package*.json ./\", \"RUN npm install --legacy-peer-deps\", \"\", \"COPY . .\", \"\", \"RUN npx expo prebuild --platform android --clean\", \"\", \"RUN sed -i 's/org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx12g -Xms4g -XX:MaxMetaspaceSize=2g -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200/' android/gradle.properties\", \"RUN grep -qxF 'org.gradle.parallel=true' android/gradle.properties || echo 'org.gradle.parallel=true' >> android/gradle.properties\", \"RUN grep -qxF 'org.gradle.caching=true' android/gradle.properties || echo 'org.gradle.caching=true' >> android/gradle.properties\", \"RUN grep -qxF 'org.gradle.configureondemand=true' android/gradle.properties || echo 'org.gradle.configureondemand=true' >> android/gradle.properties\", \"RUN grep -qxF 'org.gradle.daemon=true' android/gradle.properties || echo 'org.gradle.daemon=true' >> android/gradle.properties\", \"RUN grep -qxF 'kotlin.incremental=true' android/gradle.properties || echo 'kotlin.incremental=true' >> android/gradle.properties\", \"RUN grep -qxF 'kotlin.daemon.jvm.options=-Xmx4g' android/gradle.properties || echo 'kotlin.daemon.jvm.options=-Xmx4g' >> android/gradle.properties\", \"RUN grep -qxF 'android.enableR8.fullMode=false' android/gradle.properties || echo 'android.enableR8.fullMode=false' >> android/gradle.properties\", \"RUN sed -i '/^android\.enableBuildCache/d' android/gradle.properties\", \"\", \"RUN which python3 || (apt-get update && apt-get install -y python3)\", \"RUN python3 inject_signing.py\", \"\", \"WORKDIR /app/android\", \"RUN --mount=type=cache,target=/root/.gradle ./gradlew assembleRelease --build-cache --parallel -Dfile.encoding=UTF-8\", \"\", \"RUN mkdir -p /output && cp app/build/outputs/apk/release/app-release.apk /output/\"); $d -join \"`n\" | Set-Content -Path '%PROJECT%\Dockerfile' -Encoding UTF8"

:: ─── [5/6] Build Docker image ─────────────────────────────────────────────────
echo.
echo [5/6] Building Docker image...
cd /d "%PROJECT%"
set DOCKER_BUILDKIT=1
docker build --progress=plain -t %DOCKER_IMAGE% .
if %errorlevel% neq 0 (
    echo ERROR: Docker build failed.
    pause & exit /b 1
)

:: ─── [6/6] Extract APK and push to GitHub Releases ───────────────────────────
echo.
echo [6/6] Extracting APK and releasing...

docker rm -f %DOCKER_CONTAINER% >nul 2>&1
docker create --name %DOCKER_CONTAINER% %DOCKER_IMAGE%
if %errorlevel% neq 0 (
    echo ERROR: Failed to create Docker container.
    pause & exit /b 1
)

docker cp %DOCKER_CONTAINER%:/output/app-release.apk "%PROJECT%\app-release.apk"
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy APK from container.
    docker rm %DOCKER_CONTAINER% >nul 2>&1
    pause & exit /b 1
)

docker rm %DOCKER_CONTAINER% >nul 2>&1
echo APK extracted to: %PROJECT%\app-release.apk

cd /d "%PROJECT%"
for /f "delims=" %%i in ('node -e "console.log(require('./app.json').expo.version)"') do set VERSION=%%i
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TIMESTAMP=%%T

gh release create "v%VERSION%-%TIMESTAMP%" "%PROJECT%\app-release.apk" --title "OwnLift v%VERSION%" --notes "Release v%VERSION% built %TIMESTAMP%"
if %errorlevel% neq 0 (
    echo ERROR: GitHub release failed. APK saved at %PROJECT%\app-release.apk
    pause & exit /b 1
)

echo.
echo === Done! APK released as v%VERSION%-%TIMESTAMP% ===
pause