/**
 * 测试配置 - 不使用真实X平台URL
 */
const CONFIG = {
  // === 浏览器配置 ===
  
  // 会话配置
  profileDir: "./test-profile",
  headless: true, // 测试使用非无头模式
  
  // Chrome便携版路径
  chromeExecutablePath: null,
  
  // Playwright启动配置
  launchOptions: {
    headless: true, // 测试使用非无头模式
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  },
  
  // === 调度配置 ===
  
  interval: 50000, // 5秒检查一次（测试用）
  crawlInterval: 130000, // 30秒抓取一次（测试用）
  
  // === 抓取配置 ===
  
  maxItemsPerCrawl: 10, // 测试用，最多10条
  maxCharsPerCrawl: 1000, // 测试用，最多1000字
  
  // === 行为模拟配置 ===
  
  minDelay: 1000, // 测试用，最小延迟1秒
  maxDelay: 2000, // 测试用，最大延迟2秒
  scrollDelay: 500, // 测试用，滚动延迟0.5秒
  scrollDistance: 1000, // 测试用，滚动距离
  
  // === 目标URLs ===
  
  targets: [
    "https://example.com", // 使用测试URL
    "https://httpbin.org/html" // 另一个测试URL
  ],
  
  // === 日志配置 ===
  
  logLevel: "debug", // 测试用debug级别
  logFile: "./logs/test-crawler.log",
  
  // === 数据存储 ===
  
  dataFile: "./data/test-data.jsonl",
  
  // === 监控配置 ===
  
  checkLoginInterval: 10000, // 10秒检查一次（测试用）
  maxRetries: 1, // 测试用，最大重试1次
  retryDelay: 2000, // 测试用，重试延迟
  
  // === 调试配置 ===
  
  debug: true, // 测试用调试模式
  screenshotOnError: true // 错误时截图
};

module.exports = CONFIG;