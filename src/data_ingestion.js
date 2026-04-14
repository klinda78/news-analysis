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
  const promises = [];
  for (const [id, info] of crawlerProcesses) {
    promises.push(new Promise((resolve) => {
      const proc = info.process;
      let finished = false;

      const done = () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      };

      proc.on('exit', done);
      proc.on('close', done);

      // 在 Windows 上，child.kill() 是立即终止。
      // 因为 Ctrl+C 会同时发给主进程和子进程，子进程已经在处理 SIGINT 了。
      // 我们等待其自行关闭，如果超时还没关掉再强制杀掉。
      if (process.platform === 'win32') {
        setTimeout(() => {
          if (!finished) {
            proc.kill(); 
            done();
          }
        }, 8000); // 给 8 秒时间清理，Playwright 启动/关闭较慢
      } else {
        proc.kill('SIGTERM');
        setTimeout(done, 8000);
      }
    }));
  }
  
  if (promises.length > 0) {
    console.log(`正在等待 ${promises.length} 个子进程关闭...`);
    await Promise.all(promises);
  }
  crawlerProcesses.clear();
};

async function ingestFromCrawlerPersistent(source) {
  const config = require('./config.json');
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
  
  // 生成子模块专用配置文件
  const targetsFilePath = (source.targets || []).map(t => {
    if (t.startsWith('http')) return t;
    return `https://x.com/${t}`;
  });
  const crawlerConfig = { targets };
  const configPath = path.resolve(__dirname, `crawler-config-${source.id}.json`);
  fs.writeFileSync(configPath, JSON.stringify(crawlerConfig, null, 2));

  // 把环境变量从主程序传递给子模块
  const proc = spawn('node', [modulePath], {
    env: {
      ...process.env,
      PARENT_PID: process.pid,
      CRAWLER_OUTPUT_DIR: outputDir,
      CRAWL_INTERVAL_MS: String(source.interval || 30 * 60 * 1000),
      CRAWLER_CONFIG_FILE: configPath
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  const info = {
    process: proc,
    outputDir: path.join(outputDir, source.id),
    ready: false,
    pendingFiles: []
  };
  
  // 必须立即加入管理，否则启动超时会导致进程“失联”无法关闭
  crawlerProcesses.set(source.id, info);

  let stdoutBuffer = '';
  proc.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // 保持最后一行（可能不完整）在 buffer 中

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      try {
        const msg = JSON.parse(trimmedLine);
        // 兼容不同的就绪信号
        if (msg.type === 'session_ready' || msg.type === 'ready') {
          info.ready = true;
          console.log(`[${source.id}] 收到就绪信号`);
        }
        if (msg.type === 'data_ready') {
          if (msg.file) {
            info.pendingFiles.push(msg.file);
          } else {
            console.log(`[${source.id}] 收到数据就绪信号，等待文件同步...`);
          }
        }
      } catch {
        // 非 JSON 输出，直接作为日志打印
        console.log(`[${source.id}] ${trimmedLine}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    console.error(`[${source.id} ERROR] ${data.toString().trim()}`);
  });

  let exitError = null;
  proc.on('exit', (code) => {
    if (!info.ready) {
      exitError = new Error(`子进程意外退出，退出码: ${code}`);
    }
    // 清理临时配置文件
    if (fs.existsSync(configPath)) {
      try { fs.unlinkSync(configPath); } catch {}
    }
    crawlerProcesses.delete(source.id);
  });
  
  // 等待就绪
  try {
    await new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (info.ready) {
          clearInterval(check);
          resolve();
        }
        if (exitError) {
          clearInterval(check);
          reject(exitError);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(check);
        reject(new Error('启动超时，请检查子模块日志'));
      }, 60000);
    });
    console.log(`[${source.id}] 常驻进程就绪`);
  } catch (err) {
    console.warn(`[${source.id}] ${err.message}`);
    // 虽然超时，但 info 已经加入 crawlerProcesses，主进程退出请求时仍会尝试关闭它
  }
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