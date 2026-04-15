#!/usr/bin/env node

/**
 * 最终验证 - 直接检查页面内容
 */
const { chromium } = require('playwright');
const CONFIG = require('./config');
async function finalVerification() {
  console.log('=== 最终登录状态验证 ===\n');
  
  const chromePath = chromium.executablePath();
  const chromeDataDir = CONFIG.profileDir;
  
  console.log('使用正确的profile路径启动...\n');
  
  let browser = null;
  let page = null;
  
  try {
    // 启动浏览器
    browser = await chromium.launchPersistentContext('./final-test-profile', {
      executablePath: chromePath,
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        `--user-data-dir=${chromeDataDir}`
      ]
    });
    
    page = await browser.newPage();
    
    // 访问X平台
    console.log('访问 https://x.com ...');
    await page.goto('https://x.com', { 
      waitUntil: 'networkidle',
      timeout: 40000 
    });
    
    console.log('✅ 页面加载完成\n');
    
    // 方法1：直接检查页面HTML内容
    console.log('=== 页面内容分析 ===');
    
    const pageContent = await page.content();
    
    // 检查关键关键词
    const keywords = {
      '登录相关': ['Log in', '登录', 'Sign in', 'Log out', '退出登录', '登录到 X'],
      '用户相关': ['Home', '首页', 'Explore', '探索', 'Notifications', '通知', 'Messages', '消息'],
      '推文相关': ['Tweet', '推文', 'Post', '发布', 'What’s happening', '发生了什么']
    };
    
    console.log('关键词检查:');
    for (const [category, words] of Object.entries(keywords)) {
      const found = words.filter(word => pageContent.includes(word));
      if (found.length > 0) {
        console.log(`  ${category}: ${found.join(', ')}`);
      }
    }
    
    // 方法2：检查特定元素
    console.log('\n=== 元素检查 ===');
    
    const elements = await page.evaluate(() => {
      const results = {};
      
      // 检查登录相关元素
      results.loginInputs = {
        username: document.querySelector('input[name="text"], input[name="username"]') !== null,
        password: document.querySelector('input[type="password"]') !== null,
        loginButton: document.querySelector('button[data-testid="loginButton"], button:contains("Log in")') !== null
      };
      
      // 检查用户界面元素
      results.uiElements = {
        sidebar: document.querySelector('[data-testid="sidebarColumn"]') !== null,
        tweetButton: document.querySelector('[data-testid="tweetButton"]') !== null,
        searchBox: document.querySelector('[data-testid="searchBox"]') !== null
      };
      
      // 检查推文
      results.tweets = document.querySelectorAll('article[data-testid="tweet"]').length;
      
      // 获取页面标题和URL
      results.title = document.title;
      results.url = window.location.href;
      
      return results;
    });
    
    console.log('登录输入框:');
    console.log(`  用户名输入: ${elements.loginInputs.username ? '❌ 存在' : '✅ 不存在'}`);
    console.log(`  密码输入: ${elements.loginInputs.password ? '❌ 存在' : '✅ 不存在'}`);
    console.log(`  登录按钮: ${elements.loginInputs.loginButton ? '❌ 存在' : '✅ 不存在'}`);
    
    console.log('\nUI元素:');
    console.log(`  侧边栏: ${elements.uiElements.sidebar ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  发推按钮: ${elements.uiElements.tweetButton ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  搜索框: ${elements.uiElements.searchBox ? '✅ 存在' : '❌ 不存在'}`);
    
    console.log(`\n推文数量: ${elements.tweets}`);
    console.log(`页面标题: ${elements.title}`);
    console.log(`当前URL: ${elements.url}`);
    
    // 方法3：尝试导航到用户页面
    console.log('\n=== 功能测试 ===');
    
    if (!elements.loginInputs.username && !elements.loginInputs.password) {
      console.log('尝试访问用户页面...');
      await page.goto('https://x.com/elonmusk', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      const canAccessUserPage = await page.evaluate(() => {
        return !document.querySelector('input[name="text"]') && 
               document.querySelector('article[data-testid="tweet"]');
      });
      
      console.log(`访问用户页面: ${canAccessUserPage ? '✅ 成功' : '❌ 失败'}`);
    }
    
    // 最终判断
    console.log('\n=== 最终判断 ===');
    
    const needsLogin = elements.loginInputs.username || elements.loginInputs.password;
    
    if (needsLogin) {
      console.log('❌ 需要登录');
      console.log('请在浏览器窗口中手动登录X平台...');
      console.log('登录后关闭浏览器，然后重新运行测试。');
    } else {
      if (elements.tweets > 0 || elements.uiElements.sidebar) {
        console.log('✅ 已登录状态确认！');
        console.log('\n🎉 好消息！可以直接使用这个登录状态。');
        console.log('\n下一步：');
        console.log('1. 运行主程序: pnpm start');
        console.log('2. 确保config.js中headless: true');
        console.log('3. 程序会自动使用这个登录状态抓取数据');
      } else {
        console.log('⚠️  不确定状态');
        console.log('可能的原因：');
        console.log('1. X平台页面结构变化');
        console.log('2. 需要与页面交互才能显示内容');
        console.log('3. 网络或加载问题');
        
        console.log('\n建议：');
        console.log('1. 在浏览器中手动检查是否已登录');
        console.log('2. 如果未登录，手动登录一次');
        console.log('3. 登录后关闭浏览器，cookies会被保存');
      }
    }
    
    // 截图
    console.log('\n截图保存...');
    await page.screenshot({ 
      path: './final-verification-screenshot.png',
      fullPage: true 
    });
    console.log('✅ 完整页面截图已保存');
    
  } catch (error) {
    console.error('\n❌ 验证失败:', error.message);
    
  } finally {
    if (browser) {
      console.log('\n关闭浏览器...');
      await browser.close();
      console.log('✅ 浏览器已关闭');
    }
    
    console.log('\n=== 验证完成 ===');
  }
}

// 运行验证
if (require.main === module) {
  finalVerification().catch(error => {
    console.error('验证运行失败:', error);
    process.exit(1);
  });
}