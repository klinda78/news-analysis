const { chromium } = require('playwright');
const CONFIG = require('../config');
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * X平台会话管理器
 * 使用Playwright Persistent Context保持登录状态
 */
class SessionManager {
  constructor() {
    this.context = null;
    this.page = null;
    this.queue = [];
    this.running = false;
    this.isLoggedIn = false;
    this.loginCheckInterval = null;
    this.schedulerInterval = null;
    this.crawlCount = 0;
    this.charCount = 0;
  }

  /**
   * 初始化会话管理器
   */
  async init() {
    try {
      logger.info('正在初始化Session Manager...');
      
      // 确保profile目录存在
      await this.ensureProfileDir();
      
      // 准备启动选项
      const launchOptions = {
        ...CONFIG.launchOptions,
        headless: CONFIG.headless
      };
      
      // 如果配置了Chrome便携版路径，使用它
      if (CONFIG.chromeExecutablePath) {
        launchOptions.executablePath = CONFIG.chromeExecutablePath;
        logger.info(`使用Chrome便携版: ${CONFIG.chromeExecutablePath}`);
      } else {
        logger.info('使用Playwright自带Chromium');
      }
      
      // 启动Persistent Context
      logger.info(`正在启动Persistent Context，profile目录: ${CONFIG.profileDir}`);
      logger.debug('启动选项:', launchOptions);
      
      this.context = await chromium.launchPersistentContext(CONFIG.profileDir, launchOptions);
      
      // 创建页面实例
      this.page = await this.context.newPage();
      logger.success('Persistent Context启动成功');
      
      // 设置页面超时
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);
      
      // 检查登录状态
      await this.checkLoginStatus();
      
      // 启动调度器
      this.startScheduler();
      
      // 启动登录状态监控
      this.startLoginMonitor();
      let msg = {
        type:"session_ready"
      }
      console.log(JSON.stringify(msg));
      logger.success('Session Manager初始化完成');
      return true;
    } catch (error) {
      logger.fail('Session Manager初始化失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 确保profile目录存在
   */
  async ensureProfileDir() {
    try {
      await fs.access(CONFIG.profileDir);
      logger.info(`Profile目录已存在: ${CONFIG.profileDir}`);
    } catch {
      await fs.mkdir(CONFIG.profileDir, { recursive: true });
      logger.info(`创建Profile目录: ${CONFIG.profileDir}`);
    }
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    try {
      logger.info('正在检查登录状态...');
      
      // 导航到X首页
      await this.page.goto('https://x.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      await this.sleep(2000);
      
      // 检查是否显示登录页面
      const content = await this.page.content();
      const hasLoginButton = content.includes('Log in') || 
                            content.includes('登录') || 
                            content.includes('Sign in');
      
      if (hasLoginButton) {
        this.isLoggedIn = false;
        logger.warning('检测到未登录状态，需要手动登录');
        logger.warning('请按照以下步骤操作：');
        logger.warning('1. 在打开的浏览器窗口中手动登录X平台');
        logger.warning('2. 登录成功后，关闭浏览器窗口');
        logger.warning('3. 重新运行程序（headless可设为true）');
        
        // 等待用户手动登录
        await this.waitForManualLogin();
      } else {
        this.isLoggedIn = true;
        logger.success('检测到已登录状态');
        
        // 获取当前用户名
        const username = await this.getCurrentUsername();
        if (username) {
          logger.success(`当前登录用户: ${username}`);
        }
      }
      
      return this.isLoggedIn;
    } catch (error) {
      logger.fail('检查登录状态失败', { error: error.message });
      this.isLoggedIn = false;
      return false;
    }
  }

  /**
   * 等待用户手动登录
   */
  async waitForManualLogin() {
    if (CONFIG.headless) {
      logger.error('headless模式下无法进行手动登录，请将headless设为false后重新运行');
      process.exit(1);
    }
    
    logger.info('等待用户手动登录...（按Ctrl+C退出）');
    
    // 每30秒检查一次登录状态
    const checkInterval = setInterval(async () => {
      try {
        const content = await this.page.content();
        const hasLoginButton = content.includes('Log in') || 
                              content.includes('登录') || 
                              content.includes('Sign in');
        
        if (!hasLoginButton) {
          clearInterval(checkInterval);
          this.isLoggedIn = true;
          logger.success('手动登录成功！');
          
          // 获取用户名
          const username = await this.getCurrentUsername();
          if (username) {
            logger.success(`登录用户: ${username}`);
          }
          
          // 保存profile
          await this.page.context().storageState({ path: path.join(CONFIG.profileDir, 'state.json') });
          logger.success('登录状态已保存');
          
          logger.info('现在可以关闭浏览器窗口，并将config.js中的headless改为true后重新运行');
        }
      } catch (error) {
        logger.fail('检查手动登录状态失败', { error: error.message });
      }
    }, 300000);
  }

  /**
   * 获取当前用户名
   */
  async getCurrentUsername() {
    try {
      // 尝试从页面获取用户名
      const username = await this.page.evaluate(() => {
        // 尝试多种选择器获取用户名
        const selectors = [
          'a[href*="/settings"] div[dir="auto"] span',
          '[data-testid="SideNav_AccountSwitcher_Button"] div[dir="auto"] span',
          'a[role="link"][href*="/"] div[dir="auto"] span'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        return null;
      });
      
      return username;
    } catch (error) {
      logger.debug('获取用户名失败', { error: error.message });
      return null;
    }
  }

  /**
   * 启动调度器
   */
  startScheduler() {
    logger.info(`启动调度器，抓取间隔: ${CONFIG.crawlInterval / 60000}分钟`);
    
    this.schedulerInterval = setInterval(() => {
      this.enqueueCrawlTasks();
    }, CONFIG.crawlInterval);
    
    // 立即执行一次
    this.enqueueCrawlTasks();
  }

  /**
   * 将抓取任务加入队列
   */
  enqueueCrawlTasks() {
    if (!this.isLoggedIn) {
      logger.warning('未登录状态，跳过任务调度');
      return;
    }
    
    logger.info('调度抓取任务...');
    
    // 重置计数器
    this.crawlCount = 0;
    this.charCount = 0;
    
    for (const url of CONFIG.targets) {
      const task = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        url,
        type: 'crawl',
        timestamp: new Date().toISOString(),
        retryCount: 0
      };
      
      this.enqueue(task);
      logger.info(`任务加入队列: ${url}`);
    }
  }

  /**
   * 将任务加入队列
   */
  enqueue(task) {
    this.queue.push(task);
    logger.debug(`队列长度: ${this.queue.length}`);
    
    if (!this.running) {
      this.run();
    }
  }

  /**
   * 运行队列中的任务
   */
  async run() {
    if (this.running) {
      logger.debug('任务执行器已在运行中');
      return;
    }
    
    this.running = true;
    logger.info('开始执行队列任务...');

    while (this.queue.length > 0 && this.isLoggedIn) {
      const task = this.queue.shift();
      
      try {
        logger.info(`执行任务: ${task.url} (剩余: ${this.queue.length})`);
        
        // 检查是否达到限制
        if (this.crawlCount >= CONFIG.maxItemsPerCrawl) {
          logger.warning(`已达到最大抓取数量限制: ${CONFIG.maxItemsPerCrawl}`);
          break;
        }
        
        if (this.charCount >= CONFIG.maxCharsPerCrawl) {
          logger.warning(`已达到最大字符数限制: ${CONFIG.maxCharsPerCrawl}`);
          break;
        }
        
        await this.execute(task);
        
        // 随机延迟，模拟人类行为
        const delay = CONFIG.minDelay + Math.random() * (CONFIG.maxDelay - CONFIG.minDelay);
        logger.debug(`等待 ${Math.round(delay/1000)}秒...`);
        await this.sleep(delay);
        
      } catch (error) {
        logger.fail(`任务执行失败: ${task.url}`, { 
          error: error.message,
          taskId: task.id 
        });
        
        // 重试逻辑
        if (task.retryCount < CONFIG.maxRetries) {
          task.retryCount++;
          logger.info(`任务重试 ${task.retryCount}/${CONFIG.maxRetries}: ${task.url}`);
          this.queue.unshift(task); // 放回队列开头
          await this.sleep(CONFIG.retryDelay);
        } else {
          logger.error(`任务放弃: ${task.url} (已达到最大重试次数)`);
        }
      }
    }

    this.running = false;
    // 通知已移至 saveData 中，实现按批次通知
    logger.info('队列任务执行完成');
  }

  /**
   * 执行抓取任务
   */
  async execute(task) {
    logger.info(`开始抓取: ${task.url}`);
    
    // 导航到目标页面
    await this.page.goto(task.url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 等待页面加载
    await this.sleep(10000);
    
    // 模拟滚动行为（固定2次）
    logger.debug('模拟滚动行为...');
    await this.page.mouse.wheel(0, CONFIG.scrollDistance);
    await this.sleep(CONFIG.scrollDelay);
    await this.page.mouse.wheel(0, CONFIG.scrollDistance);
    await this.sleep(CONFIG.scrollDelay);
    
    // 提取数据
    const data = await this.page.evaluate(() => {
      const articles = document.querySelectorAll('article');
      const results = [];
      
      for (const article of articles) {
        try {
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const timeEl = article.querySelector('time');
          const linkEl = article.querySelector('a[href*="/status/"]');
          
          const text = textEl?.innerText?.trim() || '';
          const time = timeEl?.getAttribute('datetime') || '';
          const link = linkEl?.href || '';
          
          if (text || time || link) {
            results.push({ text, time, link });
          }
        } catch (e) {
          // 忽略单个文章解析错误
        }
      }
      
      return results;
    });
    
    // 处理抓取结果
    const itemCount = data.length;
    const charCount = data.reduce((sum, item) => sum + (item.text?.length || 0), 0);
    
    this.crawlCount += itemCount;
    this.charCount += charCount;
    
    logger.success(`抓取完成: ${task.url}`, {
      items: itemCount,
      chars: charCount,
      totalItems: this.crawlCount,
      totalChars: this.charCount
    });
    
    // 保存数据
    await this.saveData(data, task.url);
    
    return data;
  }

  /**
   * 保存数据到JSONL文件
   */
  async saveData(data, sourceUrl) {
    if (!data || data.length === 0) {
      logger.debug('无数据可保存');
      return;
    }
    
    try {
      const timestamp = new Date().toISOString();
      const lines = data.map(item => JSON.stringify({
        ...item,
        source_url: sourceUrl,
        crawled_at: timestamp,
        platform: 'x'
      })).join('\n') + '\n';
      
      let outputDir = CONFIG.dataFile;
      if (process.env.CRAWLER_OUTPUT_DIR) {
        outputDir = process.env.CRAWLER_OUTPUT_DIR;
      }
      
      // 使用唯一文件名，防止被主模块 unlink 后覆盖或丢失
      const filename = `x-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.jsonl`;
      const dataFile = path.resolve(outputDir, filename);
      
      await fs.appendFile(dataFile, lines, 'utf8');
      logger.debug(`数据已保存到: ${dataFile} (${data.length}条)`);
      
      // 通知主程序
      console.log(JSON.stringify({
        type: 'data_ready',
        file: dataFile,
        timestamp: Date.now()
      }));
      
    } catch (error) {
      logger.fail('保存数据失败', { error: error.message });
    }
  }

  /**
   * 启动登录状态监控
   */
  startLoginMonitor() {
    logger.info('启动登录状态监控...');
    
    this.loginCheckInterval = setInterval(async () => {
      try {
        const wasLoggedIn = this.isLoggedIn;
        await this.checkLoginStatus();
        
        if (wasLoggedIn && !this.isLoggedIn) {
          logger.error('登录状态丢失！');
          // 可以在这里触发警报或重启逻辑
        }
      } catch (error) {
        logger.fail('登录状态监控失败', { error: error.message });
      }
    }, CONFIG.checkLoginInterval);
  }

  /**
   * 休眠指定时间
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 关闭会话管理器
   */
  async close() {
    logger.info('正在关闭Session Manager...');
    
    // 清除定时器
    if (this.loginCheckInterval) {
      clearInterval(this.loginCheckInterval);
    }
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    
    // 关闭页面和上下文
    if (this.page) {
      await this.page.close().catch(() => {});
    }
    
    if (this.context) {
      await this.context.close().catch(() => {});
    }
    
    logger.success('Session Manager已关闭');
  }
}

module.exports = SessionManager;