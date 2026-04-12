#!/usr/bin/env node
const XPlatformCrawler = require('../src/index.js');
const fs = require('fs').promises;
const path = require('path');

const isSubprocess = process.env.PARENT_PID !== undefined;
const OUTPUT_DIR = process.env.CRAWLER_OUTPUT_DIR || './output';
const CRAWL_INTERVAL = parseInt(process.env.CRAWL_INTERVAL_MS) || 30 * 60 * 1000; // 默认30分钟

let crawler = null;
let crawlTimer = null;

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// 单次抓取任务
async function doCrawl() {
  try {
    console.log(JSON.stringify({ 
      type: 'crawl_start', 
      timestamp: Date.now() 
    }));

    const data = await crawler.crawl(); // 你的抓取方法
    
    if (!data || data.length === 0) {
      console.log(JSON.stringify({ type: 'crawl_empty', timestamp: Date.now() }));
      return;
    }

    // 写入文件
    const filename = `x-${Date.now()}.jsonl`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    const lines = Array.isArray(data) ? data : [data];
    const jsonl = lines.map(r => JSON.stringify(r)).join('\n') + '\n';
    await fs.writeFile(filepath, jsonl);

    // 通知主程序
    console.log(JSON.stringify({
      type: 'data_ready',
      file: filepath,
      count: lines.length,
      timestamp: Date.now()
    }));

  } catch (err) {
    console.log(JSON.stringify({ 
      type: 'crawl_error', 
      error: err.message,
      timestamp: Date.now()
    }));
  }
}

// 启动流程
async function main() {
  await ensureDir(OUTPUT_DIR);

  // 错误捕获
  process.on('uncaughtException', (err) => {
    console.log(JSON.stringify({ type: 'fatal_error', error: err.message }));
    process.exit(1);
  });

  // 初始化 crawler（建立 Session）
  crawler = new XPlatformCrawler();
  await crawler.start(); // 这里建立常驻 Session

  // 子进程模式
  if (isSubprocess) {
    // 报告就绪
    console.log(JSON.stringify({ 
      type: 'ready',
      pid: process.pid,
      interval: CRAWL_INTERVAL,
      timestamp: Date.now()
    }));

    // 定时抓取
    crawlTimer = setInterval(doCrawl, CRAWL_INTERVAL);
    
    // 立即执行一次
    doCrawl();

    // 监听关闭信号
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } else {
    // 独立模式：立即抓取一次后退出，或保持运行
    await doCrawl();
    console.log('单次模式完成');
    await gracefulShutdown();
  }
}

async function gracefulShutdown() {
  console.log(JSON.stringify({ type: 'shutting_down', pid: process.pid }));
  
  if (crawlTimer) clearInterval(crawlTimer);
  if (crawler) await crawler.cleanup();
  
  console.log(JSON.stringify({ type: 'shutdown', pid: process.pid }));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});