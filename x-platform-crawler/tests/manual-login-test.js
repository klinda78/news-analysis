#!/usr/bin/env node

/**
 * 手动登录测试 - 需要用户配合
 */
const { chromium } = require('playwright');
const path = require('path');

async function manualLoginTest() {
  console.log('=== X平台手动登录测试 ===\n');
  console.log('这个测试将打开浏览器，需要你手动登录X平台。\n');
  
  const profileDir = '../manual-login-profile';
  let browser = null;
  
  try {
    // 1. 清理并创建测试目录
    console.log('1. 准备测试环境...');
    const fs = require('fs').promises;
    await fs.rm(profileDir, { recursive: true, force: true });
    await fs.mkdir(profileDir, { recursive: true });
    
    // 2. 获取配置
    const config = require('../config-test.js');
    
    // 3. 启动浏览器（必须非无头模式）
    console.log('2. 启动浏览器...');
    console.log(`使用Chrome: ${chromium.executablePath()}`);
    console.log('浏览器即将打开，请准备登录...\n');
    
    const launchOptions = {
      ...config.launchOptions,
      headless: false, // 必须为false，需要手动操作
      executablePath: chromium.executablePath()
    };
    
    browser = await chromium.launchPersistentContext(profileDir, launchOptions);
    const page = await browser.newPage();
    
    // 4. 导航到X平台
    console.log('3. 导航到X平台...');
    await page.goto('https://x.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 300000 
    });
    
    console.log('=== 需要你手动操作 ===');
    console.log('请在打开的浏览器窗口中：');
    console.log('1. 手动登录你的X平台账号');
    console.log('2. 完成所有登录步骤（包括二次验证）');
    console.log('3. 登录成功后，看到X平台主页面');
    console.log('4. 不要关闭浏览器窗口\n');
    
    console.log('我有60秒时间等待你登录...');
    console.log('我会每5秒检查一次登录状态。\n');
    
    // 5. 等待用户手动登录
    let isLoggedIn = false;
    let checkCount = 0;
    const maxChecks = 2; // 60秒 / 5秒
    
    while (checkCount < maxChecks && !isLoggedIn) {
      checkCount++;
      console.log(`检查登录状态 (${checkCount}/${maxChecks})...`);
      
      try {
        // 获取页面内容检查登录状态
        const content = await page.content();
        const hasLoginButton = content.includes('Log in') || 
                              content.includes('登录') || 
                              content.includes('Sign in');
        
        if (!hasLoginButton) {
          isLoggedIn = true;
          console.log('✅ 检测到已登录状态！');
          
          // 尝试获取用户名
          const username = await page.evaluate(() => {
            const selectors = [
              'a[href*="/settings"] div[dir="auto"] span',
              '[data-testid="SideNav_AccountSwitcher_Button"] div[dir="auto"] span',
              'div[data-testid="SideNav_AccountSwitcher_Button"] span'
            ];
            
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent) {
                return element.textContent.trim();
              }
            }
            return null;
          });
          
          if (username) {
            console.log(`✅ 登录用户: ${username}`);
          } else {
            console.log('✅ 已登录（用户名未获取）');
          }
          break;
        }
      } catch (error) {
        console.log(`检查失败: ${error.message}`);
      }
      
      // 等待5秒再检查
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (isLoggedIn) {
      // 6. 保存登录状态
      console.log('\n4. 保存登录状态...');
      await browser.storageState({ path: path.join(profileDir, 'state.json') });
      console.log('✅ 登录状态已保存到:', path.join(profileDir, 'state.json'));
      
      // 7. 验证保存的状态
      console.log('\n5. 验证保存的状态...');
      try {
        const state = JSON.parse(await fs.readFile(path.join(profileDir, 'state.json'), 'utf8'));
        
        if (state.cookies && state.cookies.length > 0) {
          console.log(`✅ 保存了 ${state.cookies.length} 个cookies`);
          
          // 显示一些重要的cookies
          const importantCookies = state.cookies.filter(c => 
            c.name.includes('auth') || 
            c.name.includes('token') || 
            c.name.includes('session')
          );
          
          if (importantCookies.length > 0) {
            console.log('重要cookies:');
            importantCookies.slice(0, 3).forEach(cookie => {
              console.log(`  - ${cookie.name} (${cookie.domain})`);
            });
          }
        }
      } catch (error) {
        console.log('⚠️ 状态验证失败:', error.message);
      }
      
      console.log('\n=== 登录测试成功 ===\n');
      console.log('🎉 手动登录完成！');
      console.log('\n下一步：');
      console.log('1. 现在可以运行主程序了');
      console.log('2. 首次运行: pnpm start (headless: false)');
      console.log('3. 登录成功后，可以将headless改为true');
      console.log('4. 重新运行: pnpm start');
      
    } else {
      console.log('\n❌ 登录超时或失败');
      console.log('可能的原因：');
      console.log('1. 未在60秒内完成登录');
      console.log('2. 登录过程中出现错误');
      console.log('3. 网络问题');
      console.log('\n建议：');
      console.log('1. 重新运行测试');
      console.log('2. 检查网络连接');
      console.log('3. 确保X平台可以正常访问');
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误详情:', error.stack || error);
    
    if (error.message.includes('timeout')) {
      console.log('\n⚠️  超时错误，可能原因：');
      console.log('1. 网络慢或无法访问X平台');
      console.log('2. 代理设置问题');
      console.log('3. X平台服务器响应慢');
    }
    
  } finally {
    // 清理
    console.log('\n清理资源...');
    if (browser) {
      await browser.close().catch(() => {});
      console.log('✅ 浏览器已关闭');
    }
    
    console.log('\n测试完成！');
  }
}

// 运行测试
if (require.main === module) {
  manualLoginTest().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}