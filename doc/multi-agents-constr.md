## 本文件帮助你理解多专家系统的agent的架构。
当前多专家系统包含至少三个agent
1：news-agent
2:invest-agent
3:content-agent

### news-agent
```


```


### invest-agent
```mermaid
graph TD
    soul["soul.md\n(agent价值观、偏好)"] --> thinking_model["thinking_model.md\n(决策逻辑)"]
    knowledge_base["knowledge_base.md\n(通用知识)"] --> OPPORTUNITY_FRAMEWORK["OPPORTUNITY_FRAMEWORK.md\n(策略知识/机会框架)"]
    OPPORTUNITY_FRAMEWORK --> thinking_model

```

文件结构
```
invest-agent/
│
├─ AGENT.md                 # Agent整体身份与能力概览
├─ identity.md              # 角色定位、职责范围、交互能力
├─ soul.md                  # 投资风格、风险偏好、价值观约束
│
├─ skill/
│   ├─ market_map.md        # 市场信息结构、行业层级、标的/信号图谱
│   └─ knowledge_base.md    # 投资相关知识、公式、规则、经验条目
│
├─ algorithm/
│   ├─ thinking_model.md    # 决策逻辑、推理流程、优先级
│   └─ OPPORTUNITY_FRAMEWORK.md  # 机会识别方法、触发条件、风险收益框架
│
└─ memory/
    ├─ OPPORTUNITY_STATE.md # 当前机会状态、评分、处理阶段
    └─ MEMORY.md            # 历史事件、决策记录、经验积累

```
🔹 引用与依赖关系（逻辑）
```code
thinking_model.md → 引用 soul.md 的价值观和风险偏好
OPPORTUNITY_FRAMEWORK.md → 可以引用 knowledge_base.md 的理论知识
thinking_model.md → 可调用 OPPORTUNITY_FRAMEWORK.md 输出作为决策输入
所有记忆类文件 → 可以被算法类文件读取，用于优化决策
```
🔹 各个文件说明  
1. 身份与核心信息类
文件：AGENT.md、identity.md、soul.md
侧重点：Agent 的身份、定位、目标与行为风格
```
AGENT.md
核心目标：定义整个 agent 的整体身份与功能定位
核心内容：
名称、类型、版本
能力概览（skill类模块链接）
行为模式/工作风格
高层目标与任务范围
呈现形式：简介 + 列表 + 关联模块链接
identity.md
核心目标：明确 agent 的“角色身份”
核心内容：
Agent 的职责与权限范围
核心特征（比如市场分析专家、内容挖掘专家）
交互能力与适用场景
呈现形式：属性表 + 简述
soul.md
核心目标：定义 agent 的“内在思维风格与价值观”
核心内容：
推理偏好（逻辑、直觉、概率）
风险偏好（保守、均衡、激进）
决策优先级和价值观约束
长期行为倾向与使命感
呈现形式：描述性文字 + 行为规则示例
```
2 . 其他文件作用说明
| 文件类型 | 文件 | 核心目标 | 核心内容 | 形式化呈现 |
| --- | --- | --- | --- | --- |
| skill | market_map.md | 能力认知 | 市场结构、指标、信号 | 层级/图谱 |
| skill | knowledge | 知识储备 | _ | 表格/条目 |
| 算法 | thinking_model.md | _ | 推理规则、流程、优先级 | 流程图/伪代码 |
| 算法 | OPPORTUNITY_FRAME | 机会识别 | 触发条件、风险收益 | _ |
| 记忆 | OPPORTUNITY_STATE.md | 当前机会状态 | 机会评分、阶段 | 表格/状态机 |
| 记忆 | MEMORY.md | 历史记录 | 决策记录、经验 | 时间序列/日志条目 |
