/**
 * 抓取马斯克今天发的推文 - 修复版
 * 处理Chrome++ version.dll冲突问题
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

async function fetchMuskTweetsFixed() {
  console.log('=== 开始抓取马斯克今天推文（修复版）===\n');
  
  const chromePath = chromium.executablePath;
  const userDataDir = CONFIG.dataDir;
  const muskUrl = 'https://x.com/elonmusk';

  let browser = null;
  let page = null;
  
  try {

    
    // 2. 启动Chrome-portable
    console.log('\n2. 启动Chrome-portable...');
    
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromePath,
      headless: false, // 显示浏览器以便调试
      viewport: { width: 1280, height: 800 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      timeout: 30000
    });
    
    console.log('✅ Chrome-portable启动成功');
    
    // 3. 创建页面并访问马斯克主页
    page = await context.newPage();
    
    console.log('\n3. 访问马斯克主页:', muskUrl);
    await page.goto(muskUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    console.log('✅ 页面加载成功');
    
    // 等待页面稳定
    await page.waitForTimeout(5000);
    
    // 4. 检查登录状态
    console.log('\n4. 检查登录状态...');
    const loginForm = await page.$('input[name="text"][autocomplete="username"]');
    if (loginForm) {
      console.log('❌ 检测到登录表单，可能需要登录');
      console.log('请手动登录后按Enter继续...');
      
      // 截图当前状态
      const loginScreenshot = path.join(__dirname, 'login-prompt.png');
      await page.screenshot({ path: loginScreenshot });
      console.log(`📸 登录提示截图: ${loginScreenshot}`);
      
      // 等待手动登录
      await page.waitForTimeout(60000); // 等待60秒手动登录
    } else {
      console.log('✅ 已登录状态确认');
      
      // 截图确认
      const loggedInScreenshot = path.join(__dirname, 'logged-in.png');
      await page.screenshot({ path: loggedInScreenshot });
      console.log(`📸 登录状态截图: ${loggedInScreenshot}`);
    }
    
    // 5. 尝试获取推文
    console.log('\n5. 尝试获取推文...');
    
    // 等待推文加载
    await page.waitForTimeout(3000);
    
    // 尝试滚动加载更多推文
    await page.evaluate(() => {
      window.scrollBy(0, 1000);
    });
    await page.waitForTimeout(2000);
    
    // 方法1：使用通用选择器
    const tweetSelectors = [
      'article[data-testid="tweet"]',
      'div[data-testid="tweet"]',
      'article',
      'div[role="article"]'
    ];
    
    let tweets = [];
    for (const selector of tweetSelectors) {
      const found = await page.$$(selector);
      if (found.length > 0) {
        console.log(`  使用选择器 "${selector}" 找到 ${found.length} 个元素`);
        tweets = found;
        break;
      }
    }
    
    console.log(`总共找到 ${tweets.length} 个推文元素`);
    
    // 6. 提取推文信息
    const todayTweets = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    for (let i = 0; i < Math.min(tweets.length, 15); i++) {
      try {
        const tweet = tweets[i];
        
        // 获取推文文本
        let text = '';
        const textSelectors = [
          'div[data-testid="tweetText"]',
          'div[lang]',
          'div.css-1rynq56'
        ];
        
        for (const selector of textSelectors) {
          const textElement = await tweet.$(selector);
          if (textElement) {
            text = await textElement.textContent();
            text = text.trim();
            if (text) break;
          }
        }
        
        // 获取时间
        let time = '';
        const timeElement = await tweet.$('time');
        if (timeElement) {
          time = await timeElement.getAttribute('datetime');
        }
        
        // 获取链接
        let tweetUrl = '';
        const linkElement = await tweet.$('a[href*="/status/"]');
        if (linkElement) {
          const href = await linkElement.getAttribute('href');
          if (href) {
            tweetUrl = `https://x.com${href}`;
          }
        }
        
        // 检查是否是今天的推文
        const isToday = time && time.includes(todayStr);
        
        todayTweets.push({
          index: i + 1,
          text: text ? (text.substring(0, 300) + (text.length > 300 ? '...' : '')) : '无文本',
          time: time || '未知时间',
          url: tweetUrl || muskUrl,
          isToday: isToday
        });
        
      } catch (err) {
        console.log(`  推文 ${i+1} 提取失败:`, err.message);
      }
    }
    
    // 7. 输出结果
    console.log('\n=== 抓取结果 ===');
    
    const todayOnlyTweets = todayTweets.filter(t => t.isToday);
    
    if (todayOnlyTweets.length > 0) {
      console.log(`找到 ${todayOnlyTweets.length} 条今天(${todayStr})的推文:`);
      todayOnlyTweets.forEach((tweet, idx) => {
        console.log(`\n[${idx + 1}] ${tweet.time}`);
        console.log(`   内容: ${tweet.text}`);
        if (tweet.url && tweet.url !== muskUrl) {
          console.log(`   链接: ${tweet.url}`);
        }
      });
    } else {
      console.log(`未找到今天(${todayStr})的推文`);
      console.log('\n最近推文:');
      todayTweets.slice(0, 5).forEach((tweet, idx) => {
        console.log(`\n[${idx + 1}] ${tweet.time} ${tweet.isToday ? '(今天)' : ''}`);
        console.log(`   内容: ${tweet.text}`);
      });
    }
    
    // 8. 保存结果
    const resultPath = path.join(__dirname, 'musk-tweets-results.json');
    fs.writeFileSync(resultPath, JSON.stringify({
      date: todayStr,
      totalTweets: todayTweets.length,
      todayTweets: todayOnlyTweets.length,
      allTweets: todayTweets,
      fetchedAt: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n💾 详细结果已保存: ${resultPath}`);
    
    // 9. 保存页面文本供分析
    const pageText = await page.textContent('body');
    const textPath = path.join(__dirname, 'page-text.txt');
    fs.writeFileSync(textPath, pageText);
    console.log(`📝 页面文本已保存: ${textPath}`);
    
    // 10. 最终截图
    const finalScreenshot = path.join(__dirname, 'final-page.png');
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`📸 完整页面截图: ${finalScreenshot}`);
    
    console.log('\n✅ 抓取完成！');
    console.log('浏览器将保持打开30秒供检查...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('\n❌ 抓取失败:', error.message);
    console.error('错误堆栈:', error.stack);
    
    // 尝试保存错误截图
    try {
      if (page) {
        const errorPath = path.join(__dirname, 'error-screenshot.png');
        await page.screenshot({ path: errorPath });
        console.log(`📸 错误截图已保存: ${errorPath}`);
      }
    } catch (screenshotError) {
      console.error('无法保存错误截图:', screenshotError.message);
    }
    
  } finally {
    // 清理资源
    try {
      if (page) await page.close();
      if (browser) await browser.close();
      console.log('\n✅ 浏览器资源清理完成');
    } catch (closeError) {
      console.error('关闭资源时出错:', closeError.message);
    }
    
  }
}

// 执行抓取
fetchMuskTweetsFixed().catch(console.error);