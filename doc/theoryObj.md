## How an event has tradable value:

```mermaid
flowchart LR
    Source1[Event Sources]
    Source2[Social Spread]
    Source3[Capital Flow]

    Source1 --> Detection
    Source2 --> Detection
    Source3 --> Detection

    Detection --> Signal
```



## An life status of an event:
```flowchart
Phase 1 研究 / 弱信号 
Phase 2 专家讨论 
Phase 3 事件催化 
Phase 4 扩散 
Phase 5 共识（已经晚了）
```
## Source types
```flowchart
Idea content yard  \twitter -- narrative  
Knowledge Market \google\bilibili  -- deep insign  
Behavior Ma rket  \taobao\pingduoduo -- real demand  
Expectation Market  *Polymarket** -- capital flow in
```
## Dataresource types:
```flowchart
entity_type:
account   → KOL / 人 / 机构账号
webpage   → 页面
api       → 数据接口
dataset   → 数据集
```
## Event types
```flowchart
Policy Event
Supply Shock
Demand Shock
Liquidity Event
Reputation Crisis
Technology Breakthrough
Macro Trigger
```
## Event-driven multi-expert system
```mermaid
flowchart TD 
    A[Event Source]
    A --> B[News Monitor Agent<br/>筛选事件 +聚类=>enrich_event_obj]
    B --> C[Content Operator Agent<br/>聚焦事件演化<br/>&#40传播加速 + 跨圈扩散&#41]
    C --> D[Investment Research Agent<br/> 初步资产映射+ 验证 + 构建交易假设]
    D --> E[Main Agent<br/>选择是否执行 / 调整策略]
    E --> F[Execution / Strategy System]
```
