# X平台数据抓取工具

基于Playwright Persistent Context的X平台数据抓取工具，使用会话管理机制避免被封号。

## 特性

- ✅ **持久化会话**: 使用`launchPersistentContext`保持登录状态
- ✅ **反爬策略**: 模拟人类行为，避免被检测为爬虫
- ✅ **稳定可靠**: 完善的错误处理和重试机制
- ✅ **易于监控**: 详细的日志记录和状态监控
- ✅ **数据完整**: 自动保存到JSONL格式，便于后续处理

## 架构设计

```
Playwright Persistent Context
        ↓
    单Page实例
        ↓
    Session Manager
        ↓
    任务调度器
        ↓
    数据抓取
        ↓
    JSONL存储
```

### 核心决策

1. **使用`launchPersistentContext`** - 不要普通launch
2. **只开一个page** - 不要多tab
3. **所有任务串行执行** - 避免并发触发风控

## 快速开始

### 1. 安装依赖

```bash
cd x-platform-crawler

# 使用npm
npm install

# 或使用pnpm
pnpm install
```

### 2. 配置

编辑 `config.js` 文件：

```javascript
const CONFIG = {
  profileDir: "./profile",      // 会话存储目录
  headless: false,              // 首次运行设为false，手动登录
  interval: 10000,              // 调度间隔
  targets: [                    // 抓取目标
    "https://x.com/elonmusk",
    "https://x.com/search?q=Powell"
  ]
};
```

### 3. 首次运行（手动登录）

```bash
# 首次运行，headless必须为false
npm start
```

**手动登录步骤**：
1. 浏览器窗口会自动打开
2. 手动登录X平台账号
3. 登录成功后，关闭浏览器窗口
4. 将`config.js`中的`headless`改为`true`
5. 重新运行程序

### 4. 正常运行

```bash
# headless模式运行
npm start
```

## 项目结构

```
x-platform-crawler/
├── src/
│   ├── index.js              # 主程序入口
│   ├── session-manager.js    # 会话管理器
│   └── logger.js             # 日志工具
├── tests/
│   ├── test-session-manager.js  # 会话管理器测试
│   ├── test-login.js         # 登录流程测试
│   └── test-crawl.js         # 抓取逻辑测试
├── config.js                 # 配置文件
├── package.json             # 项目配置
└── README.md               # 说明文档
```

## 数据格式

数据以JSONL格式保存到 `data/x_data.jsonl`：

```json
{
  "text": "推文内容",
  "time": "2024-01-01T12:00:00Z",
  "link": "https://x.com/user/status/1234567890",
  "source_url": "https://x.com/elonmusk",
  "crawled_at": "2024-01-01T12:00:00Z",
  "platform": "x"
}
```

## 测试

### 运行所有测试

```bash
npm test
```

### 单独测试

```bash
# 测试会话管理器
node tests/test-session-manager.js

# 测试登录流程（需要手动操作）
node tests/test-login.js

# 测试抓取逻辑
node tests/test-crawl.js
```

## 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `profileDir` | 会话存储目录 | `"./profile"` |
| `headless` | 无头模式 | `false`（首次） |
| `interval` | 调度间隔 | `10000`（10秒） |
| `crawlInterval` | 抓取间隔 | `1200000`（20分钟） |
| `maxItemsPerCrawl` | 每次最多抓取条数 | `300` |
| `maxCharsPerCrawl` | 每次最多字符数 | `10000` |
| `targets` | 抓取目标URL列表 | `[]` |

## 监控和日志

- 日志文件：`logs/crawler.log`
- 控制台实时输出
- 登录状态监控（每分钟检查一次）

## 故障排除

### 常见问题

1. **登录状态丢失**
   - 检查profile目录权限
   - 重新运行手动登录流程
   - 检查X平台是否更改了登录机制

2. **抓取失败**
   - 检查网络连接
   - 查看日志中的错误信息
   - 调整抓取间隔和延迟

3. **被封号风险**
   - 减少抓取频率
   - 增加随机延迟
   - 使用代理IP

### 调试模式

设置 `config.js` 中的 `logLevel: "debug"` 查看详细日志。

## 安全建议

1. **不要分享profile目录** - 包含登录cookies
2. **定期备份数据** - 数据文件在`data/`目录
3. **监控使用情况** - 避免触发平台限制
4. **遵守平台规则** - 合理使用，避免滥用

## 许可证

MIT License