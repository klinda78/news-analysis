#!/usr/bin/env node
const XPlatformCrawler = require('../src/index.js');
const path = require('path');

/**
 * 爬虫启动脚本 (Wrapper)
 */
async function main() {
  // 检查是否作为子进程运行
  const isSubprocess = process.env.PARENT_PID !== undefined;
  
  if (isSubprocess) {
    // 子进程模式下，XPlatformCrawler 内部逻辑会处理定时任务和就绪报告
    const crawler = new XPlatformCrawler();
    await crawler.start();
  } else {
    // 独立模式
    const crawler = new XPlatformCrawler();
    await crawler.start();
    // 注意：crawler.start() 内部有 keepAlive，所以会持续运行
  }
}

main().catch(err => {
  console.error('Fatal error in start script:', err);
  process.exit(1);
});