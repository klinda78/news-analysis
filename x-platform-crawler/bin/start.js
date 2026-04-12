#!/usr/bin/env node
const XPlatformCrawler = require('../src/index.js');

const isSubprocess = process.env.PARENT_PID !== undefined;

if (isSubprocess) {
  // 错误捕获
  process.on('uncaughtException', (err) => {
    console.log(JSON.stringify({ type: 'error', error: err.message }));
    process.exit(1);
  });

  const crawler = new XPlatformCrawler();
  
  crawler.start().then(() => {
    // 报告就绪
    console.log(JSON.stringify({ 
      type: 'ready',
      pid: process.pid,
      timestamp: Date.now()
    }));
    
    // 注册关闭信号
    process.on('SIGTERM', () => gracefulShutdown(crawler));
    process.on('SIGINT', () => gracefulShutdown(crawler));
    
  }).catch(err => {
    console.log(JSON.stringify({ 
      type: 'error', 
      error: `Start failed: ${err.message}` 
    }));
    process.exit(1);
  });

} else {
  // 独立启动
  require('../src/index.js');
}

async function gracefulShutdown(crawler) {
  console.log(JSON.stringify({ type: 'shutting_down', pid: process.pid }));
  
  try {
    // 使用 cleanup() 而不是 shutdown()
    await crawler.cleanup();
    
    console.log(JSON.stringify({ type: 'shutdown', pid: process.pid }));
    process.exit(0);
  } catch (err) {
    console.log(JSON.stringify({ 
      type: 'error', 
      error: `Shutdown failed: ${err.message}` 
    }));
    process.exit(1);
  }
}