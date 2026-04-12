/**
 * X平台抓取配置
 */
const CONFIG = {
  // === 浏览器配置 ===
  
  // 会话配置
  profileDir: "./profile",
  headless: true, // 首次运行时设为false，手动登录后可以改为true
  
  // Chrome便携版路径（如果使用Playwright自带Chromium，设为null）
  chromeExecutablePath: null,
  //chromeExecutablePath: "D:\\infra\\Chrome-portable\\chrome.exe",
  
  // Playwright启动配置
  launchOptions: {
    // 如果chromeExecutablePath不为null，会自动设置executablePath
    headless: true, // 会被CONFIG.headless覆盖
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  },
  
  // === 调度配置 ===
  
  interval: 10000, // 10秒检查一次任务队列
  crawlInterval: 20 * 60 * 1000, // 20分钟抓取一次
  
  // === 抓取配置 ===
  
  maxItemsPerCrawl: 300, // 每次最多抓取300条
  maxCharsPerCrawl: 10000, // 每次最多10000字
  
  // === 行为模拟配置 ===
  
  minDelay: 3000, // 最小延迟3秒
  maxDelay: 5000, // 最大延迟5秒
  scrollDelay: 1000, // 滚动延迟1秒
  scrollDistance: 2000, // 滚动距离
  
  // === 目标URLs ===
  
  targets: [
    "https://x.com/Danny_Crypton",
    "https://x.com/search?q=Powell"
  ],
  
  // === 日志配置 ===
  
  logLevel: "info",
  logFile: "./logs/crawler.log",
  
  // === 数据存储 ===
  
  dataFile: "./data/x_data.jsonl",
  
  // === 监控配置 ===
  
  checkLoginInterval: 60000, // 每分钟检查一次登录状态
  maxRetries: 3, // 最大重试次数
  retryDelay: 50000, // 重试延迟
  
  // === 调试配置 ===
  
  debug: false, // 调试模式
  screenshotOnError: true // 错误时截图
};

module.exports = CONFIG;