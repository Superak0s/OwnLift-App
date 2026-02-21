@echo off
setlocal

set PROJECT=C:\Users\Superak0s\Documents\Coding\SuperGym\SuperGym-App
set DOCKER_IMAGE=supergym-builder
set DOCKER_CONTAINER=sg-build

echo === SuperGym App Release Script (Docker Build) ===

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

:: ─── [0/5] Version Bump ───────────────────────────────────────────────────────
echo.
echo [0/5] Version management...

for /f "delims=" %%i in ('node -e "console.log(require('%PROJECT:\=\\%/package.json').version)"') do set CURRENT_VERSION=%%i
for /f "delims=" %%i in ('node -e "const v='%CURRENT_VERSION%'.split('.'); v[2]=parseInt(v[2])+1; console.log(v.join('.'))"') do set AUTO_VERSION=%%i

echo Current version: %CURRENT_VERSION%
echo.
echo [1] Auto-increment to %AUTO_VERSION%
echo [2] Enter custom version
echo.
set /p VERSION_CHOICE="Choose (1 or 2, default=1): "
if "%VERSION_CHOICE%"=="" set VERSION_CHOICE=1

if "%VERSION_CHOICE%"=="2" (
    set /p NEW_VERSION="Enter custom version (e.g. 2.0.0): "
    if "!NEW_VERSION!"=="" (
        echo ERROR: No version entered.
        pause & exit /b 1
    )
) else (
    set NEW_VERSION=%AUTO_VERSION%
)

echo Updating version to: %NEW_VERSION%

node -e "const fs=require('fs'); const p=require('%PROJECT:\=\\%/package.json'); p.version='%NEW_VERSION%'; fs.writeFileSync('%PROJECT:\=\\%/package.json', JSON.stringify(p, null, 2)+'\n')"
node -e "const fs=require('fs'); const a=require('%PROJECT:\=\\%/app.json'); a.expo.version='%NEW_VERSION%'; fs.writeFileSync('%PROJECT:\=\\%/app.json', JSON.stringify(a, null, 2)+'\n')"

echo Version updated successfully!

:: ─── [1/5] Push source to GitHub ─────────────────────────────────────────────
echo.
echo [1/5] Pushing source code to GitHub...
cd /d "%PROJECT%"
git add .
set /p COMMIT_MSG="Enter commit message (or press Enter for default): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Release update
git commit -m "%COMMIT_MSG%"
git push origin main

:: ─── [2/5] Clear Metro cache ──────────────────────────────────────────────────
echo.
echo [2/5] Clearing Metro cache...
if exist "%TEMP%\metro-cache" rmdir /s /q "%TEMP%\metro-cache"

:: ─── [3/5] Write Dockerfile and .dockerignore ────────────────────────────────
echo.
echo [3/5] Writing Dockerfile...

powershell -NoProfile -Command "$ignore = \"node_modules`nandroid`n.git`n*.log`n.expo`nios`n\"; Set-Content -Path '%PROJECT%\.dockerignore' -Value $ignore -Encoding UTF8;"

powershell -NoProfile -Command "$d = @(\"FROM reactnativecommunity/react-native-android:latest\", \"\", \"ENV GRADLE_OPTS='-Xmx6g -XX:MaxMetaspaceSize=2g'\", \"ENV NODE_ENV=production\", \"\", \"WORKDIR /app\", \"\", \"COPY package*.json ./\", \"RUN npm install --legacy-peer-deps\", \"\", \"COPY . .\", \"\", \"RUN npx expo prebuild --platform android --clean\", \"\", \"RUN sed -i 's/org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g/' android/gradle.properties\", \"RUN printf 'org.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.configureondemand=true\n' >> android/gradle.properties\", \"\", \"WORKDIR /app/android\", \"RUN --mount=type=cache,target=/root/.gradle ./gradlew assembleRelease\", \"\", \"RUN mkdir -p /output && cp app/build/outputs/apk/release/app-release.apk /output/\"); $d -join \"`n\" | Set-Content -Path '%PROJECT%\Dockerfile' -Encoding UTF8"

:: ─── [4/5] Build Docker image ─────────────────────────────────────────────────
echo.
echo [4/5] Building Docker image...
cd /d "%PROJECT%"
set DOCKER_BUILDKIT=1
docker build --progress=plain -t %DOCKER_IMAGE% .
if %errorlevel% neq 0 (
    echo ERROR: Docker build failed.
    pause & exit /b 1
)

:: ─── [5/5] Extract APK and push to GitHub Releases ───────────────────────────
echo.
echo [5/5] Extracting APK and releasing...

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

gh release create "v%VERSION%-%TIMESTAMP%" "%PROJECT%\app-release.apk" --title "SuperGym v%VERSION%" --notes "Release v%VERSION% built %TIMESTAMP%"
if %errorlevel% neq 0 (
    echo ERROR: GitHub release failed. APK saved at %PROJECT%\app-release.apk
    pause & exit /b 1
)

echo.
echo === Done! APK released as v%VERSION%-%TIMESTAMP% ===
pause