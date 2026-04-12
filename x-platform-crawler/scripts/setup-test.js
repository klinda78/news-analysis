#!/usr/bin/env node

/**
 * 设置和测试脚本
 * 帮助用户验证环境并运行测试
 */
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function setupAndTest() {
  console.log('=== X平台抓取工具设置和测试 ===\n');
  
  try {
    // 1. 检查Node.js
    console.log('1. 检查Node.js...');
    const nodeVersion = execSync('node -v').toString().trim();
    console.log(`   ✅ Node.js版本: ${nodeVersion}`);
    
    // 2. 检查包管理器
    console.log('2. 检查包管理器...');
    let packageManager = 'npm';
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      packageManager = 'pnpm';
      console.log('   ✅ 检测到pnpm');
    } catch {
      try {
        execSync('npm --version', { stdio: 'ignore' });
        console.log('   ✅ 检测到npm');
      } catch {
        throw new Error('未找到npm或pnpm');
      }
    }
    
    // 3. 检查依赖
    console.log('3. 检查依赖...');
    try {
      require('playwright');
      console.log('   ✅ Playwright已安装');
    } catch {
      console.log('   ⚠️  Playwright未安装，正在安装...');
      execSync(`${packageManager} install`, { stdio: 'inherit' });
    }
    
    // 4. 检查Chrome-portable
    console.log('4. 检查Chrome-portable...');
    const chromePath = 'D:\\infra\\Chrome-portable\\chrome.exe';
    
    try {
      await fs.access(chromePath);
      console.log(`   ✅ Chrome-portable存在: ${chromePath}`);
      
      // 更新配置文件
      const configPath = path.join(__dirname, '..', 'config.js');
      let configContent = await fs.readFile(configPath, 'utf8');
      
      if (configContent.includes('chromeExecutablePath: null')) {
        configContent = configContent.replace(
          'chromeExecutablePath: null, // 使用Playwright自带Chromium',
          `chromeExecutablePath: "${chromePath.replace(/\\/g, '\\\\')}",`
        );
        await fs.writeFile(configPath, configContent, 'utf8');
        console.log('   ✅ 已更新config.js使用Chrome-portable');
      } else if (configContent.includes('chromeExecutablePath:')) {
        console.log('   ℹ️  config.js已配置Chrome路径');
      }
    } catch {
      console.log('   ⚠️  Chrome-portable不存在，将使用Playwright Chromium');
    }
    
    // 5. 运行项目验证
    console.log('\n5. 运行项目验证...');
    try {
      const { verifyProject } = require('../scripts/verify.js');
      await verifyProject();
    } catch (error) {
      console.log(`   ❌ 项目验证失败: ${error.message}`);
      console.log('   正在尝试修复...');
      
      // 创建缺失的目录
      const dirs = ['src', 'tests', 'scripts', 'logs', 'data', 'profile'];
      for (const dir of dirs) {
        try {
          await fs.mkdir(path.join(__dirname, '..', dir), { recursive: true });
          console.log(`      创建目录: ${dir}`);
        } catch {}
      }
    }
    
    // 6. 运行单元测试
    console.log('\n6. 运行单元测试...');
    try {
      console.log('   运行抓取逻辑测试...');
      execSync('node tests/test-crawl.js', { stdio: 'inherit' });
      console.log('   ✅ 抓取逻辑测试通过');
    } catch {
      console.log('   ⚠️  抓取逻辑测试失败，但可以继续');
    }
    
    try {
      console.log('\n   运行Session Manager测试...');
      execSync('node tests/test-session-manager.js', { stdio: 'inherit' });
      console.log('   ✅ Session Manager测试通过');
    } catch {
      console.log('   ⚠️  Session Manager测试失败，但可以继续');
    }
    
    // 7. 测试Chrome兼容性（如果配置了Chrome-portable）
    console.log('\n7. 测试Chrome兼容性...');
    try {
      const config = require('../config.js');
      if (config.chromeExecutablePath) {
        console.log(`   测试Chrome-portable: ${config.chromeExecutablePath}`);
        execSync('node tests/test-chrome-portable.js', { stdio: 'inherit' });
        console.log('   ✅ Chrome兼容性测试通过');
      } else {
        console.log('   ℹ️  未配置Chrome-portable，跳过兼容性测试');
      }
    } catch (error) {
      console.log(`   ⚠️  Chrome兼容性测试失败: ${error.message}`);
      console.log('   建议：运行 npx playwright install chromium 安装Playwright Chromium');
    }
    
    // 8. 总结
    console.log('\n=== 设置完成 ===\n');
    console.log('✅ 环境设置完成！');
    console.log('\n下一步：');
    console.log(`1. 编辑 config.js 设置抓取目标`);
    console.log(`2. 首次运行: ${packageManager} start (headless必须为false)`);
    console.log(`3. 按照提示手动登录X平台`);
    console.log(`4. 登录成功后，将config.js中的headless改为true`);
    console.log(`5. 重新运行: ${packageManager} start`);
    console.log('\n需要帮助？运行以下命令：');
    console.log(`  ${packageManager} test          # 运行所有测试`);
    console.log(`  ${packageManager} run test:login  # 测试登录流程`);
    console.log(`  node tests/test-chrome-portable.js  # 测试Chrome兼容性`);
    
  } catch (error) {
    console.error('\n❌ 设置失败:', error.message);
    console.error(error.stack || error);
    process.exit(1);
  }
}

// 运行设置
if (require.main === module) {
  setupAndTest().catch(error => {
    console.error('设置失败:', error);
    process.exit(1);
  });
}

module.exports = { setupAndTest };