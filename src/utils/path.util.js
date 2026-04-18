const path = require('path');

// 1. 核心锚点：无论你在哪调用，__dirname 永远指向这个文件所在的目录
// 假设本文件在 project/src/utils/ 下，向上跳两级即为根
const PROJECT_ROOT = path.resolve(__dirname, '../../');

/**
 * 将配置中的相对路径转换为基于项目根目录的绝对路径
 * @param {string} configPath - config 里的相对路径，如 "./data"
 * @returns {string} - 绝对路径
 */
const toAbsPath = (configPath) => {
  // 核心逻辑：先清理掉开头的 ./，然后从根目录开始拼接
  const cleanPath = configPath.startsWith('./') ? configPath.slice(2) : configPath;
  return path.resolve(PROJECT_ROOT, cleanPath);
};

const get_source_name = (filename) => {
    const str_filename = path.basename(filename);
    const parts = str_filename.split('_');
    return parts[1];
}

module.exports = {
  PROJECT_ROOT,
  toAbsPath,
  get_source_name
};