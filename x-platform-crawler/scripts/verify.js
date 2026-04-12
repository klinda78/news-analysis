#!/usr/bin/env node

/**
 * 项目完整性验证脚本
 */
const fs = require('fs').promises;
const path = require('path');

async function verifyProject() {
  console.log('=== 验证X平台抓取工具项目完整性 ===\n');
  
  const requiredFiles = [
    'package.json',
    'config.js',
    'src/index.js',
    'src/session-manager.js',
    'src/logger.js',
    'tests/test-session-manager.js',
    'tests/test-login.js',
    'tests/test-crawl.js',
    'README.md',
    'USAGE.md'
  ];
  
  const requiredDirs = [
    'src',
    'tests',
    'scripts'
  ];
  
  let allPassed = true;
  
  // 检查必需文件
  console.log('检查必需文件...');
  for (const file of requiredFiles) {
    try {
      await fs.access(file);
      console.log(`  ✅ ${file}`);
    } catch {
      console.log(`  ❌ ${file} (缺失)`);
      allPassed = false;
    }
  }
  
  // 检查必需目录
  console.log('\n检查必需目录...');
  for (const dir of requiredDirs) {
    try {
      const stat = await fs.stat(dir);
      if (stat.isDirectory()) {
        console.log(`  ✅ ${dir}/`);
      } else {
        console.log(`  ❌ ${dir} (不是目录)`);
        allPassed = false;
      }
    } catch {
      console.log(`  ❌ ${dir}/ (缺失)`);
      allPassed = false;
    }
  }
  
  // 检查package.json
  console.log('\n检查package.json...');
  try {
    const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
    
    // 检查必需字段
    const requiredFields = ['name', 'version', 'main', 'scripts'];
    for (const field of requiredFields) {
      if (pkg[field]) {
        console.log(`  ✅ ${field}: ${JSON.stringify(pkg[field])}`);
      } else {
        console.log(`  ❌ ${field} (缺失)`);
        allPassed = false;
      }
    }
    
    // 检查依赖
    console.log('\n检查依赖...');
    const requiredDeps = ['playwright', 'winston', 'chalk'];
    for (const dep of requiredDeps) {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        console.log(`  ✅ ${dep}: ${pkg.dependencies[dep]}`);
      } else {
        console.log(`  ❌ ${dep} (缺失)`);
        allPassed = false;
      }
    }
    
  } catch (error) {
    console.log(`  ❌ package.json解析失败: ${error.message}`);
    allPassed = false;
  }
  
  // 检查配置文件
  console.log('\n检查配置文件...');
  try {
    const config = require('../config.js');
    const requiredConfigs = ['profileDir', 'headless', 'targets', 'crawlInterval'];
    
    for (const key of requiredConfigs) {
      if (config[key] !== undefined) {
        console.log(`  ✅ ${key}: ${JSON.stringify(config[key])}`);
      } else {
        console.log(`  ❌ ${key} (缺失)`);
        allPassed = false;
      }
    }
  } catch (error) {
    console.log(`  ❌ config.js加载失败: ${error.message}`);
    allPassed = false;
  }
  
  // 总结
  console.log('\n=== 验证结果 ===');
  if (allPassed) {
    console.log('✅ 所有检查通过！项目完整。');
    console.log('\n下一步：');
    console.log('1. 安装依赖: pnpm install');
    console.log('2. 安装Playwright: npx playwright install chromium');
    console.log('3. 运行测试: pnpm test');
    console.log('4. 开始使用: pnpm start');
  } else {
    console.log('❌ 项目不完整，请检查缺失的文件或配置。');
    process.exit(1);
  }
}

// 运行验证
if (require.main === module) {
  verifyProject().catch(error => {
    console.error('验证失败:', error);
    process.exit(1);
  });
}

module.exports = { verifyProject };