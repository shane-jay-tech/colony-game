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
if not exist "D:\electron-cache" mkdir "D:\electron-cache"
if not exist "D:\electron-download" mkdir "D:\electron-download"

echo.
echo ====================================================
echo  邦国录 v0.7  安装依赖
echo  缓存全走 D 盘，C 盘不会被占
echo  首次安装大约 200 MB，下载几分钟
echo ====================================================
echo.

call npm install --registry=https://registry.npmmirror.com 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -FilePath 'D:\colony-game\.logs\install.log'"
set EXITCODE=%ERRORLEVEL%

echo.
echo ====================================================
echo  npm install 退出码: %EXITCODE%
echo  日志：D:\colony-game\.logs\install.log
echo ====================================================
echo.

if %EXITCODE% NEQ 0 (
    echo [失败] 看上面的报错信息
) else (
    echo [成功] 现在可以点 dev.bat 启动
)
echo.
pause
