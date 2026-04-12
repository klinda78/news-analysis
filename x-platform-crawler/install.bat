@echo off
echo === X平台数据抓取工具安装 ===

REM 检查Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到Node.js，请先安装Node.js 16+
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js版本: %NODE_VERSION%

REM 检测包管理器
set PACKAGE_MANAGER=npm
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    set PACKAGE_MANAGER=pnpm
    echo ✅ 检测到pnpm，使用pnpm安装依赖
) else (
    where npm >nul 2>nul
    if %errorlevel% equ 0 (
        echo ✅ 检测到npm，使用npm安装依赖
    ) else (
        echo ❌ 未找到npm或pnpm，请先安装
        exit /b 1
    )
)

echo ✅ 包管理器: %PACKAGE_MANAGER%

REM 安装依赖
echo 安装依赖...
call %PACKAGE_MANAGER% install

REM 安装Playwright浏览器
echo 安装Playwright浏览器...
call npx playwright install chromium

REM 创建必要目录
echo 创建目录...
if not exist profile mkdir profile
if not exist logs mkdir logs
if not exist data mkdir data

echo.
echo ✅ 安装完成！
echo.
echo 下一步：
echo 1. 编辑 config.js 文件，设置抓取目标
echo 2. 首次运行: %PACKAGE_MANAGER% start (headless必须为false)
echo 3. 按照提示手动登录X平台
echo 4. 登录成功后，将config.js中的headless改为true
echo 5. 重新运行: %PACKAGE_MANAGER% start
echo.
echo 测试：
echo   %PACKAGE_MANAGER% test          # 运行所有测试
echo   %PACKAGE_MANAGER% run test:login  # 测试登录流程
echo   %PACKAGE_MANAGER% run test:crawl  # 测试抓取逻辑
echo.
echo 清理：
echo   %PACKAGE_MANAGER% run clean    # 清理临时文件
pause