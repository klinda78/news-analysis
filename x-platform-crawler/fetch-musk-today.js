/**
 * 抓取马斯克今天发的推文
 * 使用已验证的Chrome-portable方案
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function fetchMuskTweetsToday() {
  console.log('=== 开始抓取马斯克今天推文 ===\n');
  
  const chromePath = 'D:\\infra\\Chrome-portable\\chrome.exe';
  const userDataDir = 'D:\\infra\\Chrome-portable\\Data';
  const muskUrl = 'https://x.com/elonmusk';
  
  let browser = null;
  let page = null;
  
  try {
    console.log('1. 启动Chrome-portable...');
    
    // 使用launchPersistentContext复用已有的登录状态
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromePath,
      headless: false, // 显示浏览器以便调试
      viewport: { width: 1280, height: 800 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=BlockInsecurePrivateNetworkRequests'
      ]
    });
    
    console.log('✅ Chrome-portable启动成功');
    
    // 创建新页面
    page = await context.newPage();
    
    console.log('2. 访问马斯克主页:', muskUrl);
    await page.goto(muskUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('✅ 页面加载成功');
    
    // 等待页面内容加载
    await page.waitForTimeout(3000);
    
    // 检查是否已登录
    const loginForm = await page.$('input[name="text"][autocomplete="username"]');
    if (loginForm) {
      console.log('❌ 检测到登录表单，可能需要登录');
      console.log('请手动登录后按Enter继续...');
      await page.waitForTimeout(30000); // 等待30秒手动登录
    } else {
      console.log('✅ 已登录状态确认');
    }
    
    // 截图保存当前页面状态
    const screenshotPath = path.join(__dirname, 'musk-page-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 页面截图已保存: ${screenshotPath}`);
    
    // 尝试获取今天的推文
    console.log('3. 尝试获取今天推文...');
    
    // 方法1：尝试通过推文选择器获取
    const tweets = await page.$$('article[data-testid="tweet"]');
    console.log(`找到 ${tweets.length} 个推文元素`);
    
    // 提取推文信息
    const todayTweets = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    for (let i = 0; i < Math.min(tweets.length, 10); i++) {
      try {
        const tweet = tweets[i];
        
        // 获取推文文本
        const textElement = await tweet.$('div[data-testid="tweetText"]');
        let text = '';
        if (textElement) {
          text = await textElement.textContent();
          text = text.trim();
        }
        
        // 获取时间
        const timeElement = await tweet.$('time');
        let time = '';
        if (timeElement) {
          time = await timeElement.getAttribute('datetime');
        }
        
        // 检查是否是今天的推文
        if (time && time.includes(todayStr)) {
          todayTweets.push({
            index: i + 1,
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            time: time,
            url: muskUrl
          });
        }
        
      } catch (err) {
        console.log(`  推文 ${i+1} 提取失败:`, err.message);
      }
    }
    
    // 方法2：如果选择器不工作，尝试获取页面文本
    if (todayTweets.length === 0) {
      console.log('4. 尝试备用方法：获取页面文本...');
      const pageText = await page.textContent('body');
      
      // 简单分析页面内容
      const lines = pageText.split('\n').filter(line => line.trim().length > 0);
      console.log(`页面有 ${lines.length} 行文本`);
      
      // 保存页面文本供分析
      const textPath = path.join(__dirname, 'musk-page-text.txt');
      fs.writeFileSync(textPath, pageText);
      console.log(`📝 页面文本已保存: ${textPath}`);
    }
    
    // 输出结果
    console.log('\n=== 抓取结果 ===');
    if (todayTweets.length > 0) {
      console.log(`找到 ${todayTweets.length} 条今天(${todayStr})的推文:`);
      todayTweets.forEach((tweet, idx) => {
        console.log(`\n[${idx + 1}] ${tweet.time}`);
        console.log(`   ${tweet.text}`);
      });
      
      // 保存结果到文件
      const resultPath = path.join(__dirname, 'musk-tweets-today.json');
      fs.writeFileSync(resultPath, JSON.stringify({
        date: todayStr,
        count: todayTweets.length,
        tweets: todayTweets,
        fetchedAt: new Date().toISOString()
      }, null, 2));
      console.log(`\n💾 结果已保存: ${resultPath}`);
    } else {
      console.log(`未找到今天(${todayStr})的推文`);
      console.log('可能原因：');
      console.log('1. 马斯克今天还没发推');
      console.log('2. 页面结构变化，选择器不匹配');
      console.log('3. 需要滚动加载更多推文');
    }
    
    // 保持浏览器打开一段时间供检查
    console.log('\n⏳ 浏览器将保持打开30秒供检查...');
    console.log('按Ctrl+C结束程序');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
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
      console.log('\n✅ 资源清理完成');
    } catch (closeError) {
      console.error('关闭资源时出错:', closeError.message);
    }
  }
}

// 执行抓取
fetchMuskTweetsToday().catch(console.error);