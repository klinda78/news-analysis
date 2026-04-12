/**
 * 直接截图测试
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function directScreenshot() {
  console.log('=== 直接截图测试 ===\n');
  
  const chromePath = 'D:\\infra\\Chrome-portable\\chrome.exe';
  const userDataDir = 'D:\\infra\\Chrome-portable\\Data';
  const screenshotDir = __dirname;
  
  console.log('截图将保存到:', screenshotDir);
  
  // 处理version.dll
  const versionDllPath = 'D:\\infra\\Chrome-portable\\version.dll';
  const versionDllBackup = 'D:\\infra\\Chrome-portable\\version.dll.backup';
  let versionDllRemoved = false;
  
  try {
    // 1. 临时移除version.dll
    if (fs.existsSync(versionDllPath)) {
      console.log('1. 移除version.dll...');
      fs.renameSync(versionDllPath, versionDllBackup);
      versionDllRemoved = true;
      console.log('   ✅ 完成');
    }
    
    // 2. 启动Chrome
    console.log('2. 启动Chrome...');
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromePath,
      headless: false,
      viewport: { width: 1280, height: 800 },
      args: ['--no-sandbox']
    });
    
    console.log('✅ Chrome启动成功');
    
    const page = await context.newPage();
    
    // 3. 访问X平台
    console.log('3. 访问X平台...');
    await page.goto('https://x.com', { timeout: 30000 });
    console.log('✅ 页面加载成功');
    
    // 4. 截图1: X平台主页
    const screenshot1 = path.join(screenshotDir, 'x-homepage.png');
    await page.screenshot({ path: screenshot1 });
    console.log(`📸 截图1保存: ${screenshot1}`);
    
    // 5. 访问马斯克页面
    console.log('4. 访问马斯克页面...');
    await page.goto('https://x.com/elonmusk', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // 6. 截图2: 马斯克页面
    const screenshot2 = path.join(screenshotDir, 'musk-page.png');
    await page.screenshot({ path: screenshot2 });
    console.log(`📸 截图2保存: ${screenshot2}`);
    
    // 7. 截图3: 完整页面
    const screenshot3 = path.join(screenshotDir, 'musk-fullpage.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`📸 截图3保存: ${screenshot3}`);
    
    // 8. 获取页面信息
    const title = await page.title();
    const url = page.url();
    console.log(`页面标题: ${title}`);
    console.log(`当前URL: ${url}`);
    
    // 9. 保存页面文本
    const pageText = await page.textContent('body');
    const textFile = path.join(screenshotDir, 'page-text.txt');
    fs.writeFileSync(textFile, pageText);
    console.log(`📝 页面文本保存: ${textFile}`);
    
    console.log('\n✅ 所有截图和文件已保存到:', screenshotDir);
    console.log('\n文件列表:');
    console.log('1. x-homepage.png - X平台主页截图');
    console.log('2. musk-page.png - 马斯克页面截图');
    console.log('3. musk-fullpage.png - 马斯克完整页面截图');
    console.log('4. page-text.txt - 页面文本内容');
    
    // 保持浏览器打开
    console.log('\n⏳ 浏览器将保持打开10秒...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  } finally {
    // 恢复version.dll
    if (versionDllRemoved && fs.existsSync(versionDllBackup)) {
      fs.renameSync(versionDllBackup, versionDllPath);
      console.log('\n✅ version.dll已恢复');
    }
    
    console.log('\n✅ 测试完成');
  }
}

directScreenshot().catch(console.error);