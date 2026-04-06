# Python Pre-Compression 流水线实施走查 (Walkthrough)

## 成果概览
我们已经成功为你完整搭建了处于抓取端与分析端之前的“极度轻量、零本地负担”的核心缓冲池系统——**Pre-Compression (预压缩流)**流水线代码。

### 核心设计特性的最终锚定：
- **摒弃所有重度依赖包 (0 本地推理)**：抛弃了任何如 `spaCy` 或 `PyTorch/sentence-transformers` 这种重型机器学习库。利用云端极高的算力 API 处理向量，将原本动辄 2GB 的环境压缩为纯净的数据科学包。
- **纯粹稳健的数据过滤网络**：
  - **实体/前置过滤**：利用高效静态正则与词库（替代 NLP）。
  - **云端 Embedding**：接入 智谱 API `Embedding-3`，突破性实现 CPU/RAM **接近 0 负载**，自动分发 64 条以内的安全并发请求块处理大规模信息源。
  - **本地 DBSCAN 并发聚类**：沿用基于底层 C 语言执行效率极高的 `scikit-learn` 求余弦距离进行密集族群分析。
- **客观降维打击，杜绝 LLM 标签幻觉**：所有的提取依据（第一代表文本、高频单词）全是纯数学的 `Cosine Distance` （求中心点）和 `TF-IDF` （算词频）。
- **增加客观突发指标**：在生成 8 项固定标准字段外，计算了纯标量属性 `velocity` （资讯爆发/堆积速率）以供后端参考。 
- **大模型只做 Bool 过滤器**：将唯一的评估权收到最后的 `llm_summarize` 入口，仅仅进行“是或否过滤”，确保落地 `jsonl` 原汁原味。

## 1. 模拟与基础准备

- **生成测试数据集**：你可以使用 `gen_mock_data.py` 输出 100 条混合噪音的数据。它们将会落在你的 `memory/rawdata_04012026.jsonl` 中。
- **新环境锁定**：环境已被规范至 `clean.yml`，非常清爽地仅囊括 `requests`、`numpy`、`scikit-learn` 和极简 `python=3.11.5`。

## 2. 流水线文件说明

| 文件/模块 | 角色与纯数机制 |
| ---- | ---- | 
| `pre_filter.py` | 静态极速清洗层。秒级拦截长度不足与重复的文本流。|
| `clustering.py` | 接入大厂云端接口取得最准确的多维语素浮点矩阵；接续交给本地数学距离聚类算法（DBSCAN）。|
| `filter_candidate_event.py` | 管线脱水核心：用纯公式找“质心文字”，把频率最高的词抽出当“keywords”，严格封印出只含有客观属性的 `event_obj` Json。|
| `llm_summarize.py` | “看门人”接口，仅做 True / False 分流，防漏大过滤器。|
| `main_pipeline.py` | 入口调度器，链式串列上述全流程。| 

## 下一步 & 本地执行测试命令

首先，通过你的 `clean.yml` 为这个项目创建一个极净环境：
```bash
# 在终端导入环境依赖
conda env create -f clean.yml

# 激活属于流水线的环境
conda activate news
```

由于已经剔除了最占内存的部分，程序对性能再无苛求。你只需显式地装载环境变量（或将值写死进代码的 `ZHIPU_API_KEY` 变量处）：

```powershell
# 在 powershell 中临时配置你的运行密匙 (替换成你真实注册的 key)
$env:ZHIPU_API_KEY="你的智谱_api_key"

# 优雅启动整个无压力管线
python src/Pre-Compression/main_pipeline.py
```

你将在秒级别内，看到控制台逐一筛选打印：文本经过 API 获取了多维映射，并在本地被光速聚合成有效的高价值结构体，彻底完成在 AMD 旧世代 U 上也毫发无损运行的终极 Pre-Compression 目标！
