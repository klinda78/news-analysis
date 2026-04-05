import json
import os
import sys

from pre_filter import filter_raw_data
from clustering import cluster_texts
from filter_candidate_event import is_event, format_event_obj
from llm_summarize import llm_summarize

def main():
    # 绝对路径配置
    base_dir = r"d:\onedriver\OneDrive\myproject\news-analysis\src\memory"
    input_file = os.path.join(base_dir, "rawdata_04012026.jsonl")
    output_file = os.path.join(base_dir, "event_04012026.jsonl")
    
    if not os.path.exists(input_file):
        print(f"Missing file: {input_file}")
        sys.exit(1)
        
    print("--- [Pre-Compression Pipeline Initiated] ---")
    raw_data = []
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                raw_data.append(json.loads(line))
                
    print(f"[Stage 1] Loaded {len(raw_data)} raw strings.")
    
    # 第一步：极其克制的静态洗流
    valid_data = filter_raw_data(raw_data)
    print(f"[Stage 2] After lightweight pre-filter: {len(valid_data)} effective items remaining.")
    
    # 第二步：向量提取与纯数学距离聚类
    clusters = cluster_texts(valid_data)
    print(f"[Stage 3] DBSCAN formed {len(clusters)} mathematical clusters.")
    
    # 第三步：利用统计提取关键词并组装成为 event_obj
    candidate_events = []
    for cluster in clusters:
        if is_event(cluster, threshold=3):
            event_obj = format_event_obj(cluster)
            candidate_events.append(event_obj)
            
    print(f"[Stage 4] Extracted {len(candidate_events)} candidate events (filter: size >= 3).")
    
    # 第四步：最后通过 LLM 屏障的有效性筛查，只过滤，不生成
    final_events = []
    for event in candidate_events:
        if llm_summarize(event):
            final_events.append(event)
            
    print(f"[Stage 5] After LLM Boolean Check -> {len(final_events)} high-value events approved.")
    
    # 第五步：落盘结果
    with open(output_file, 'w', encoding='utf-8') as f:
        for event in final_events:
            f.write(json.dumps(event) + "\n")
            
    print(f"--- [Success] Wrote structured event_obj objects to: {output_file} ---")

if __name__ == "__main__":
    main()
