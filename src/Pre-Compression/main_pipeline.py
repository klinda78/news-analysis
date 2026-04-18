import json
import os
import sys
import shutil
import glob
from datetime import datetime

from pre_filter import filter_raw_data
from clustering import cluster_texts
from filter_candidate_event import is_cluster_event, enrich_event_obj
from llm_summarize import llm_summarize
from Standardized_tool import StandardizedEvent
from event_engine import EventEngine

def load_config():
    # 动态获取当前文件所属路径 (src/Pre-Compression)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # 定位到父节点 src 文件夹
    src_dir = os.path.dirname(current_dir)
    config_path = os.path.normpath(os.path.join(src_dir, "..", "config.json"))
    
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f), src_dir
    return {}, src_dir

def resolve_dir(src_dir, rel_path, default):
    """将 config.json 中的相对路径解析为项目根目录的绝对路径。"""
    path = rel_path or default
    return os.path.normpath(os.path.join(src_dir, "..", path))

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
        standardized_data.append(std_data)


    # 第二步：极其克制的静态洗流（集成持久化去重）
    valid_data = filter_raw_data(standardized_data, db_path=dedup_db_path)
    print(f"[Stage 2] After lightweight pre-filter: {len(valid_data)} effective items remaining.")


    # 第三步：向量提取与纯数学距离聚类
    clusters = cluster_texts(valid_data)
    print(f"[Stage 3] DBSCAN formed {len(clusters)} mathematical clusters.")


    # 第四步: 利用调用纯数学统计提取关键词
    # enrich_event_obj 方法中调用 event_engine接口，并把候选事件写入 db table: candidate_events
    candidate_events = []
    for cluster in clusters:
        if is_cluster_event(cluster, threshold=3):
            event_obj = enrich_event_obj(cluster) 
            candidate_events.append(event_obj)
           
    print(f"[Stage 4] candidate events written {len(candidate_events)} cluster events to db table: candidate_events")
    
    # 第五步 追踪后续事件的更新
    active_cluster_events = EventEngine.track_trends(candidate_events)
    print(f"[Stage 5] cative candidate events tracked")

    # 第六步：LLM 有效性筛查（只过滤，不生成），将event对象转交给下一个业务对象
    final_events = []
    for event in active_cluster_events:
        if llm_summarize(event):
            final_events.append(event)

    print(f"[Stage 6] After LLM Boolean Check -> {len(final_events)} high-value events approved.")

    

    # 第六步：落盘结果，按运行时间戳命名
    os.makedirs(output_dir, exist_ok=True)
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"events_{run_ts}.jsonl")
    with open(output_file, "w", encoding="utf-8") as f:
        for event in final_events:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")

    print(f"--- [Success] Wrote {len(final_events)} event_obj(s) to: {output_file} ---")

def main():
    config, src_dir = load_config()

    # 从 config.json 解析三段式目录
    memory_dir     = resolve_dir(src_dir, config.get("rawdata_files_dir"),    "./data/memory")
    processing_dir = resolve_dir(src_dir, config.get("processing_data_dir"),   "./data/processing")
    archive_dir    = resolve_dir(src_dir, config.get("archive_data_dir"),      "./data/archive")
    output_dir     = resolve_dir(src_dir, config.get("output_data_dir"),       "./data/output")
    # 持久化去重数据库路径
    dedup_db_path  = resolve_dir(src_dir, os.path.join(config.get("dataDir", "./data"), "dedup.db"), "./data/dedup.db")

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

