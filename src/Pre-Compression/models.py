from pandas._typing import Level
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any

@dataclass
class EventObject:
    # 1. 核心去重标识
    event_id: str  
    
    # 2. 溯源信息：存储原始引用，方便后续从 JSONL 回溯
    source_meta: Dict[str, Any] = field(default_factory=lambda: {
        "platform": "",
        "raw_ref": "",
        "original_id": "",
        "ref_ts": 0  ## 时间
    })
    
    # 3. 核心内容：归一化处理后的文本
    content_payload: Dict[str, str] = field(default_factory=lambda: {
        "text": "",
        "clean_text": ""
    })
    
    # 4. 数学派生指标：为你的 velocity 算法留下的接口空间
    math_metrics: Dict[str, float] = field(default_factory=lambda: {
        "velocity": 0.0,
        "momentum": 0.0,
        "occurrence_count": 1
    })
    
    # 5. 状态流转信息：评估模块（evaluated events）的核心参考
    status_track: Dict[str, Any] = field(default_factory=lambda: {
        "level": 1,
        "is_new": True,
        "tags": []
    })

    def to_dict(self):
        return asdict(self)

@dataclass
class ClusterEventObject:
    cluster_id: str
    items: Dict[int,EventObject]
    centroid_text: str
    size: int
    sources: List[str]
    keywords: List[str]
    first_seen: int
    last_seen: int
    time_span: int
    velocity: float
    momentum: float
    status: str
    level: int
    