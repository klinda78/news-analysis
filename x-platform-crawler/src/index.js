#!/usr/bin/env node

const SessionManager = require('./session-manager');
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * X平台数据抓取主程序
 */
class XPlatformCrawler {
  constructor() {
    this.sessionManager = null;
    this.isShuttingDown = false;
  }

  /**
   * 启动抓取程序
   */
  async start() {
    try {
      logger.info('=== X平台数据抓取程序启动 ===');
      logger.info(`版本: ${require('../package.json').version}`);
      logger.info(`配置: ${JSON.stringify({
        headless: require('../config').headless,
        interval: `${require('../config').crawlInterval / 60000}分钟`,
        maxItems: require('../config').maxItemsPerCrawl,
        maxChars: require('../config').maxCharsPerCrawl
      }, null, 2)}`);
      
      // 确保数据目录存在
      await this.ensureDataDir();
      
      // 初始化Session Manager
      this.sessionManager = new SessionManager();
      await this.sessionManager.init();
      
      // 注册信号处理
      this.registerSignalHandlers();
      
      logger.success('X平台数据抓取程序已启动并运行');
      logger.info('按Ctrl+C停止程序');
      
      // 保持程序运行
      await this.keepAlive();
      
    } catch (error) {
      logger.fail('程序启动失败', { error: error.message, stack: error.stack });
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * 确保数据目录存在
   */
  async ensureDataDir() {
    const dirs = ['./data', './logs', './profile'];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
        logger.debug(`目录已存在: ${dir}`);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        logger.info(`创建目录: ${dir}`);
      }
    }
  }

  /**
   * 注册信号处理
   */
  registerSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        logger.warning(`收到${signal}信号，正在关闭程序...`);
        
        await this.cleanup();
        process.exit(0);
      });
    });
    
    // 未捕获异常处理
    process.on('uncaughtException', async (error) => {
      logger.fail('未捕获的异常', { error: error.message, stack: error.stack });
      await this.cleanup();
      process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      logger.fail('未处理的Promise拒绝', { reason: reason?.message || reason });
      await this.cleanup();
      process.exit(1);
    });
  }

  /**
   * 保持程序运行
   */
  async keepAlive() {
    return new Promise((resolve) => {
      // 程序会一直运行直到收到关闭信号
      // 这里只是保持Promise不resolve
    });
  }

  /**
   * 清理资源
   */
  async cleanup() {
    logger.info('正在清理资源...');
    
    if (this.sessionManager) {
      await this.sessionManager.close().catch(error => {
        logger.fail('关闭Session Manager失败', { error: error.message });
      });
    }
    
    logger.success('资源清理完成');
  }
}

// 启动程序
if (require.main === module) {
  const crawler = new XPlatformCrawler();
  crawler.start().catch(error => {
    console.error('程序启动失败:', error);
    process.exit(1);
  });
}

module.exports = XPlatformCrawler;