const winston = require('winston');
const chalk = require('chalk');
const CONFIG = require('../config');

// 自定义日志格式
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let color;
  switch (level) {
    case 'error': color = chalk.red; break;
    case 'warn': color = chalk.yellow; break;
    case 'info': color = chalk.blue; break;
    case 'debug': color = chalk.gray; break;
    default: color = chalk.white;
  }
  
  const meta = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
  return `${chalk.gray(timestamp)} ${color(`[${level.toUpperCase()}]`)} ${message}${meta}`;
});

// 创建logger实例
const logger = winston.createLogger({
  level: CONFIG.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    customFormat
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console(),
    // 文件输出
    new winston.transports.File({ 
      filename: CONFIG.logFile,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// 辅助方法
logger.success = (message, meta = {}) => {
  logger.info(`${chalk.green('✓')} ${message}`, meta);
};

logger.fail = (message, meta = {}) => {
  logger.error(`${chalk.red('✗')} ${message}`, meta);
};

logger.warning = (message, meta = {}) => {
  logger.warn(`${chalk.yellow('⚠')} ${message}`, meta);
};

module.exports = logger;