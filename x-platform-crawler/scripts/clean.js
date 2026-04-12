#!/usr/bin/env node

/**
 * 清理脚本 - 跨平台兼容
 */
const fs = require('fs').promises;
const path = require('path');

async function clean() {
  console.log('=== 清理项目临时文件 ===');
  
  const dirsToClean = [
    './profile',
    './test-profile',
    './test-login-profile'
  ];
  
  const filesToClean = [
    './logs/*.log',
    './data/*.jsonl',
    './test-data.jsonl',
    './test-crawl-data.jsonl'
  ];
  
  try {
    // 清理目录
    for (const dir of dirsToClean) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        console.log(`✅ 清理目录: ${dir}`);
      } catch (error) {
        console.log(`⚠️  清理目录失败 ${dir}: ${error.message}`);
      }
    }
    
    // 清理文件
    for (const filePattern of filesToClean) {
      try {
        // 简单的通配符处理
        if (filePattern.includes('*')) {
          const dir = path.dirname(filePattern);
          const basePattern = path.basename(filePattern);
          
          try {
            const files = await fs.readdir(dir);
            for (const file of files) {
              if (basePattern === '*' || file.includes(basePattern.replace('*', ''))) {
                const filePath = path.join(dir, file);
                await fs.unlink(filePath);
                console.log(`✅ 清理文件: ${filePath}`);
              }
            }
          } catch (error) {
            // 目录可能不存在，忽略
          }
        } else {
          await fs.unlink(filePattern);
          console.log(`✅ 清理文件: ${filePattern}`);
        }
      } catch (error) {
        // 文件可能不存在，忽略
      }
    }
    
    console.log('\n✅ 清理完成！');
    
  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 运行清理
if (require.main === module) {
  clean().catch(error => {
    console.error('清理失败:', error);
    process.exit(1);
  });
}

module.exports = { clean };