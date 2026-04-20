```
   news-analysis/
        │ 
        └── data/    
           ├── memory/   # Node.js 爬虫只管往这里写，文件命名格式为 raw_timestamp.jsonl
           │     └── rawdata.jsonl
           │  
           ├── processing/   # Python 脚本处理前，先把文件移到这里
           └── archive/   # 处理过的原始数据文件合并,按日期归档
```
原子化数据移交过程
		
```mermaid		
		graph TD
    subgraph "数据源 (Node.js 进程)"
        A[社交平台 API/爬虫] --> B{写入 raw.jsonl}
        B -->|Append| B
    end

    subgraph "触发机制 (每10-20分钟)"
        C[Python 定时任务启动]
    end

    subgraph "Python 处理流水线"
        C --> D[重命名/移动文件]
        D -->|raw.jsonl 变为| E[processing.jsonl]
        E --> F[逐行读取 JSON]
        F --> G[&#40author or twitter_status_id&#41/生成内容 Hash]
        
        G --> H{查询 SQLite 指纹库}
        
        H -- 已存在 --> I[丢弃数据: 认为是重复抓取]
        H -- 不存在 --> J[执行核心分析逻辑]
        
        J --> K[分析结果存入结果库]
        K --> L[将该 Hash 存入 SQLite 指纹库]
        
        L --> M{是否为最后一行?}
        M -- 否 --> F
        M -- 是 --> N[删除 processing.jsonl]
    end

    N --> O[结束本次运行，等待下次触发]
```
