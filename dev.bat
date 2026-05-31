@echo off
chcp 936 > nul
set TMP=D:\colony-game\.temp
set TEMP=D:\colony-game\.temp
set ELECTRON_CACHE=D:\electron-cache
set ELECTRON_BUILDER_CACHE=D:\electron-builder-cache
set ELECTRON_DOWNLOAD_PATH=D:\electron-download
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set NODE_COMPILE_CACHE=D:\colony-game\.node-compile-cache
if not exist "D:\colony-game\.temp" mkdir "D:\colony-game\.temp"
if not exist "D:\colony-game\.logs" mkdir "D:\colony-game\.logs"
if not exist "D:\npm-cache" mkdir "D:\npm-cache"
if not exist "D:\npm-global" mkdir "D:\npm-global"

if not exist "node_modules" (
    echo.
    echo [错误] node_modules 不存在
    echo 请先双击 install.bat 安装依赖，再回来跑 dev.bat
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================================
echo  邦国录 v0.7 dev mode  日志写到 D:\colony-game\.logs\
echo ====================================================
echo.

call npm run dev > "D:\colony-game\.logs\dev-stdout.log" 2> "D:\colony-game\.logs\dev-stderr.log"
set EXITCODE=%ERRORLEVEL%

echo.
echo ====================================================
echo  npm run dev 退出码: %EXITCODE%
echo ====================================================
echo.
echo --- 最后 30 行 stderr ---
powershell -NoProfile -Command "Get-Content 'D:\colony-game\.logs\dev-stderr.log' -Tail 30"
echo.
echo --- 最后 30 行 stdout ---
powershell -NoProfile -Command "Get-Content 'D:\colony-game\.logs\dev-stdout.log' -Tail 30"
echo.
echo 完整日志：D:\colony-game\.logs\dev-stdout.log
echo                D:\colony-game\.logs\dev-stderr.log
echo.
pause
