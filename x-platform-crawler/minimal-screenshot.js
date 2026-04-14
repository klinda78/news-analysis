/**
 * 极简截图测试
 */
const { chromium } = require('playwright');
const fs = require('fs');
const CONFIG = require('./config');

async function minimalScreenshot() {
  console.log('=== 极简截图测试 ===\n');
  
  const chromePath = chromium.chromeExecutablePath();
  const userDataDir = CONFIG.dataDir;
  
  console.log('工作目录:', __dirname);
  
  try {
    
    // 2. 极简启动
    console.log('启动Chrome...');
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: false,
      args: ['--no-sandbox']
    });
    
    console.log('✅ Chrome启动成功');
    
    const page = await browser.newPage();
    
    // 3. 快速访问
    console.log('访问example.com...');
    await page.goto('https://example.com', { timeout: 10000 });
    
    // 4. 截图
    const screenshotPath = 'test-screenshot.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`✅ 截图保存: ${screenshotPath}`);
    
    // 5. 检查文件
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      console.log(`文件大小: ${stats.size} bytes`);
      console.log(`文件路径: ${__dirname}\\${screenshotPath}`);
    } else {
      console.log('❌ 截图文件未生成');
    }
    
    // 6. 快速关闭
    await browser.close();
    console.log('✅ 浏览器已关闭');
    
    console.log('\n✅ 测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

minimalScreenshot().catch(console.error);