const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// 常驻爬虫管理
const crawlerProcesses = new Map();

async function dataIngestion(source) {
  
  if (source.access.mode === 'x-crawler') {
    return await ingestFromCrawlerPersistent(source);
  }
  
  // 原有 HTTP 逻辑不变
  const fetchData = require('./fetch_route');
  const parser = require('./parser');
  const rawData = await fetchData(source);
  // ... 原有落盘逻辑
};

// 关闭所有常驻进程
async function shutdown() {
  for (const [id, info] of crawlerProcesses) {
    info.process.kill('SIGTERM');
  }
  crawlerProcesses.clear();
};

async function ingestFromCrawlerPersistent(source) {
  const outputDir = path.resolve(__dirname, config.raw_data_files_path || 'memory');
  
  // 首次启动
  if (!crawlerProcesses.has(source.id)) {
    await startCrawlerProcess(source, outputDir);
    return 0; // 首次启动不产生数据
  }
  
  // 检查并处理已产生的数据文件
  const info = crawlerProcesses.get(source.id);
  return await processCrawlerOutput(info, source.id, outputDir);
}

async function startCrawlerProcess(source, outputDir) {
  const modulePath = require.resolve(`${source.module}/bin/start.js`);  //data_source.json里必须配置有：module字段, root/package.json里必须软链到实际包位置
  // 把环境变量从主程序传递给子模块
  const proc = spawn('node', [modulePath], {
    env: {
      ...process.env,
      PARENT_PID: process.pid,
      CRAWLER_OUTPUT_DIR: outputDir,
      CRAWL_INTERVAL_MS: String(source.interval || 30 * 60 * 1000)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  const info = {
    process: proc,
    outputDir: path.join(outputDir, source.id),
    ready: false,
    pendingFiles: []
  };
  
  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'ready') info.ready = true;
        if (msg.type === 'data_ready') info.pendingFiles.push(msg.file);
      } catch {
        console.log(`[${source.id}] ${line}`);
      }
    }
  });
  
  // 等待就绪
  await new Promise((resolve, reject) => {
    const check = setInterval(() => {
      if (info.ready) {
        clearInterval(check);
        resolve();
      }
    }, 100);
    setTimeout(() => reject(new Error('启动超时')), 30000);
  });
  
  crawlerProcesses.set(source.id, info);
  console.log(`[${source.id}] 常驻进程就绪`);
}

async function processCrawlerOutput(info, sourceId, outputDir) {
  const unifiedFile = path.join(outputDir, `rawdata_04012026.jsonl`);
  let count = 0;
  
  // 处理待处理文件
  const files = [...info.pendingFiles];
  info.pendingFiles = [];
  
  for (const filepath of files) {
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);
      
      for (const line of lines) {
        const record = JSON.parse(line);
        record._source = sourceId;
        fs.appendFileSync(unifiedFile, JSON.stringify(record) + '\n');
        count++;
      }
      
      fs.unlinkSync(filepath); // 清理已处理
    } catch (err) {
      console.error(`处理 ${filepath} 失败:`, err.message);
    }
  }
  
  return count;
}

module.exports = {
  ingest: dataIngestion,  // 主函数
  shutdown: shutdown      // 关闭函数
}