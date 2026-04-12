# 使用指南

## 项目概述

这是一个专门为X平台设计的抓取工具，使用Playwright Persistent Context技术保持登录状态，避免被封号。

## 快速使用步骤

### 第一步：安装
```bash
# Linux/Mac
./install.sh

# Windows
install.bat
```

### 第二步：配置
编辑 `config.js`：
```javascript
const CONFIG = {
  profileDir: "./profile",
  headless: false,  // 首次运行必须为false
  targets: [
    "https://x.com/elonmusk",
    "https://x.com/search?q=Powell"
    // 添加你的目标URL
  ]
};
```

### 第三步：首次运行（手动登录）
```bash
npm start
```

**浏览器会打开，请手动登录X平台：**
1. 输入账号密码登录
2. 完成二次验证（如果有）
3. 登录成功后，**不要关闭浏览器**
4. 程序会自动检测登录状态并保存cookies
5. 看到"登录状态已保存"提示后，可以关闭浏览器

### 第四步：正常使用
1. 将 `config.js` 中的 `headless` 改为 `true`
2. 重新运行：`npm start`
3. 程序会自动每20分钟抓取一次数据

## 数据存储

抓取的数据保存在 `data/x_data.jsonl`，格式如下：
```json
{"text":"推文内容","time":"2024-01-01T12:00:00Z","link":"https://x.com/user/status/123","source_url":"https://x.com/elonmusk","crawled_at":"2024-01-01T12:00:00Z","platform":"x"}
```

## 监控和日志

- **实时监控**: 控制台输出运行状态
- **日志文件**: `logs/crawler.log`
- **登录状态**: 每分钟自动检查

## 故障排除

### 1. 登录失败
```
❌ 检测到未登录状态，需要手动登录
```
**解决方案**：
1. 确保 `config.js` 中 `headless: false`
2. 重新运行 `npm start`
3. 仔细完成手动登录步骤

### 2. 抓取被限制
```
⚠️ 请求被限制，等待重试...
```
**解决方案**：
1. 增加 `config.js` 中的延迟时间
2. 减少抓取频率
3. 检查是否触发了X平台的风控

### 3. 程序崩溃
```
✗ 未处理的异常: ...
```
**解决方案**：
1. 查看 `logs/crawler.log` 中的详细错误
2. 运行测试检查问题：`npm test`
3. 清理并重新开始：`npm run clean && npm start`

## 高级配置

### 调整抓取行为
```javascript
// config.js
const CONFIG = {
  // 抓取间隔（毫秒）
  crawlInterval: 20 * 60 * 1000, // 20分钟
  
  // 每次抓取限制
  maxItemsPerCrawl: 300,  // 最多300条
  maxCharsPerCrawl: 10000, // 最多10000字
  
  // 行为模拟
  minDelay: 3000,  // 最小延迟3秒
  maxDelay: 5000,  // 最大延迟5秒
};
```

### 使用代理
如果需要使用代理，修改 `src/session-manager.js` 中的初始化部分：
```javascript
this.context = await chromium.launchPersistentContext(CONFIG.profileDir, {
  headless: CONFIG.headless,
  proxy: {
    server: 'http://your-proxy:port',
    username: 'user',
    password: 'pass'
  }
});
```

## 测试套件

### 运行完整测试
```bash
npm test
```

### 单独测试组件
```bash
# 测试会话管理器
node tests/test-session-manager.js

# 测试抓取逻辑（不需要真实X平台）
node tests/test-crawl.js

# 测试登录流程（需要手动操作）
node tests/test-login.js
```

## 维护建议

1. **定期备份**：备份 `profile/` 目录（包含登录状态）
2. **监控磁盘**：数据文件会逐渐增大，注意磁盘空间
3. **更新依赖**：定期运行 `npm update` 更新依赖
4. **检查日志**：定期查看 `logs/crawler.log` 发现问题

## 安全警告

⚠️ **重要安全提示**：
1. `profile/` 目录包含你的登录cookies，**不要分享给他人**
2. 数据文件可能包含敏感信息，妥善保管
3. 遵守X平台的使用条款，合理使用抓取功能
4. 建议在专用服务器或虚拟机中运行

## 获取帮助

如果遇到问题：
1. 查看 `logs/crawler.log` 获取详细错误信息
2. 运行测试检查组件是否正常：`npm test`
3. 检查配置是否正确
4. 清理并重新开始：`npm run clean`