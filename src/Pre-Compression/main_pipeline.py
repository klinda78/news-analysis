import json
import os
import sys
import shutil
import glob
from datetime import datetime

from pre_filter import filter_raw_data
from clustering import cluster_texts
from enrich_calculate import is_cluster_event, enrich_event_obj, strategy_update
from llm_summarize import llm_summarize
from standardized_tool import StandardizedEvent
from event_engine import EventEngine
from utils import path_abs

def load_config():
    config_dir = path_abs("./")
    config_file_path = os.path.normpath(os.path.join(config_dir, "./config.json"))
    
    if os.path.exists(config_file_path):
        with open(config_file_path, "r", encoding="utf-8") as f:
            return json.load(f), config_dir
    return {}, config_dir

def stage_files(memory_dir, processing_dir):
    """
    原子性地将 memory/ 中所有 raw_*.jsonl 文件移入 processing/。
    返回移动后的文件路径列表（在 processing/ 中）。
    Node.js 只往 memory/ 写，Python 只从 processing/ 读，互不干扰。
    """
    os.makedirs(processing_dir, exist_ok=True)
    pattern = os.path.join(memory_dir, "raw*.jsonl")
    candidates = sorted(glob.glob(pattern))

    if not candidates:
        return []

    staged = []
    for src_path in candidates:
        filename = os.path.basename(src_path)
        dst_path = os.path.join(processing_dir, filename)
        shutil.move(src_path, dst_path)
        staged.append(dst_path)
        print(f"  [Stage] Moved {filename} -> processing/")

    return staged

def archive_files(staged_files, archive_dir):
    """
    将已处理的原始文件按日期合并归档到 archive/archive_YYYYMMDD.jsonl。
    同一天的所有 raw 文件追加到同一个归档文件中，归档后删除 processing/ 中的副本。
    """
    os.makedirs(archive_dir, exist_ok=True)

    for file_path in staged_files:
        filename = os.path.basename(file_path)  # raw_<timestamp>.jsonl
        # 尝试从文件名提取日期前缀（raw_YYYYMMDD_... 或 raw_<epoch>）
        try:
            # 支持格式: raw_20260416_123456.jsonl 或 raw_1713267890.jsonl
            stem = filename[len("raw_"):].split(".")[0]  # e.g. "20260416_123456"
            date_tag = stem[:8]  # 取前8位作为日期
            # 简单校验是否为数字日期
            datetime.strptime(date_tag, "%Y%m%d")
        except (ValueError, IndexError):
            # 无法解析日期时，用当天日期
            date_tag = datetime.now().strftime("%Y%m%d")

        archive_file = os.path.join(archive_dir, f"archive_{date_tag}.jsonl")
        with open(file_path, "r", encoding="utf-8") as src, \
             open(archive_file, "a", encoding="utf-8") as dst:
            for line in src:
                if line.strip():
                    dst.write(line)

        os.remove(file_path)
        print(f"  [Archive] {filename} -> archive_{date_tag}.jsonl (then deleted from processing/)")

def run_pipeline(input_files, output_dir, dedup_db_path):
    """对给定的已暂存文件列表运行完整分析流水线，结果写入 output_dir。"""
    # 合并所有待处理文件中的原始数据
    standardized_data = []
    for file_path in input_files:
        # 第一步：多源数据标准化映射 require Standardized_tool.py
    
        standardized_tool = StandardizedEvent(file_path)
        raw_data = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    raw_data.append(json.loads(line))
        std_data = []
        for item in raw_data:
            std_item = standardized_tool.transform(item)
            if std_item is not None:
                std_data.append(std_item)
            
        print(f"[Stage 1] {file_path} After standardization: {len(std_data)} effective items remaining.")
        standardized_data.extend(std_data)


    # 第二步：极其克制的静态洗流（集成持久化去重）
    valid_data = filter_raw_data(standardized_data, db_path=dedup_db_path)
    print(f"[Stage 2] After lightweight pre-filter: {len(valid_data)} effective items remaining.")


    # 第三步：向量提取与纯数学距离聚类
    clusters = cluster_texts(valid_data)
    print(f"[Stage 3] DBSCAN formed {len(clusters)} mathematical clusters.")


    # 第四步: 利用调用纯数学统计进行事件的提取
    candidate_events = []
    event_engine = EventEngine(dedup_db_path)
    # 设定指标阈值,自定义策略
    metrics = {
        "momentum": 0.4,
        "velocity": 0.4,
        "level": 3,
        "status": "active"
    }
    for cluster in clusters:
        if is_cluster_event(cluster, threshold=3):
            enrich_obj = enrich_event_obj(cluster) 
            current_metrics = strategy_update(dedup_db_path, enrich_obj,**metrics)
            ## 第五步：对事件的入库逻辑
            candidates = event_engine.workflow_logic(enrich_obj,**current_metrics)
            candidate_events.append(candidates)
           
    print(f"[Stage 4] candidate events written {len(candidate_events)} cluster events to db table: candidate_events")
    
    # 第六步 追踪候选事件的动态，得到目标事件
    target_events = EventEngine.track_trends(candidate_events)
    print(f"[Stage 5] cative candidate events tracked")

    # 第七步：LLM 有效性筛查（只过滤，不生成），将event对象转交给下一个业务对象
    final_events = []
    for event in target_events:
        if llm_summarize(event):
            final_events.append(event)

    print(f"[Stage 6] After LLM Boolean Check -> {len(final_events)} high-value events approved.")


    # 第八步：落盘结果，按运行时间戳命名
    os.makedirs(output_dir, exist_ok=True)
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"events_{run_ts}.jsonl")
    with open(output_file, "w", encoding="utf-8") as f:
        for event in final_events:
            f.write(json.dumps(event.to_dict(), ensure_ascii=False) + "\n")

    print(f"--- [Success] Wrote {len(final_events)} event_obj(s) to: {output_file} ---")

def main():
    config, src_dir = load_config()

    # 从 config.json 解析三段式目录
    memory_dir     = path_abs(config.get("raw_data_files_dir"))
    processing_dir = path_abs(config.get("processing_data_dir"))
    archive_dir    = path_abs(config.get("archive_data_dir"))
    output_dir     = path_abs(config.get("output_data_dir"))

    # 持久化去重数据库路径
    dedup_db_dir  = path_abs(config.get("dataDir") or "./data")
    dedup_db_path = os.path.join(dedup_db_dir, "dedup.db")

    os.makedirs(memory_dir, exist_ok=True)

    print("--- [Pre-Compression Pipeline Initiated] ---")
    print(f"  memory/     -> {memory_dir}")
    print(f"  processing/ -> {processing_dir}")
    print(f"  archive/    -> {archive_dir}")
    print(f"  output/     -> {output_dir}")
    print(f"  dedup.db    -> {dedup_db_path}")

    # ── Step 0: 将 Node.js 写好的文件原子性移入 processing/，与 memory/ 隔离 ──
    print("\n[Step 0] Staging files from memory/ ...")
    staged_files = stage_files(memory_dir, processing_dir)

    if not staged_files:
        print("  No raw_*.jsonl files found in memory/. Nothing to process. Exiting.")
        sys.exit(0)

    print(f"  {len(staged_files)} file(s) staged for processing.")

    # ── Step 1-5: 运行完整分析流水线 ──
    print("\n[Pipeline] Running analysis ...")
    run_pipeline(staged_files, output_dir, dedup_db_path)

    # ── Step 6: 将原始文件按日期归档，清理 processing/ ──
    print("\n[Step 6] Archiving processed raw files ...")
    archive_files(staged_files, archive_dir)

    print("\n--- [Done] Pipeline completed successfully. ---")


if __name__ == "__main__":
    main()

