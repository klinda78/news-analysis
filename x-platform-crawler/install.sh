#!/bin/bash

# X平台抓取工具安装脚本（支持npm/pnpm）

set -e

echo "=== X平台数据抓取工具安装 ==="

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到Node.js，请先安装Node.js 16+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js版本过低，需要16+，当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js版本: $(node -v)"

# 检测包管理器
PACKAGE_MANAGER="npm"
if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
    echo "✅ 检测到pnpm，使用pnpm安装依赖"
elif command -v npm &> /dev/null; then
    echo "✅ 检测到npm，使用npm安装依赖"
else
    echo "❌ 未找到npm或pnpm，请先安装"
    exit 1
fi

echo "✅ 包管理器: $PACKAGE_MANAGER"

# 安装依赖
echo "安装依赖..."
if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm install
else
    npm install
fi

# 安装Playwright浏览器
echo "安装Playwright浏览器..."
npx playwright install chromium

# 创建必要目录
echo "创建目录..."
mkdir -p profile logs data

# 设置文件权限
chmod +x src/index.js scripts/clean.js

echo ""
echo "✅ 安装完成！"
echo ""
echo "下一步："
echo "1. 编辑 config.js 文件，设置抓取目标"
echo "2. 首次运行: $PACKAGE_MANAGER start (headless必须为false)"
echo "3. 按照提示手动登录X平台"
echo "4. 登录成功后，将config.js中的headless改为true"
echo "5. 重新运行: $PACKAGE_MANAGER start"
echo ""
echo "测试："
echo "  $PACKAGE_MANAGER test          # 运行所有测试"
echo "  $PACKAGE_MANAGER run test:login  # 测试登录流程"
echo "  $PACKAGE_MANAGER run test:crawl  # 测试抓取逻辑"
echo ""
echo "清理："
echo "  $PACKAGE_MANAGER run clean    # 清理临时文件"