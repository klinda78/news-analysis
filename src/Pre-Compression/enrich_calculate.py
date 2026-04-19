from sklearn.feature_extraction.text import TfidfVectorizer
from models import ClusterEventObject
from dataclasses import replace
from utils import query_event
import time

def enrich_event_obj(cluster:ClusterEventObject) -> ClusterEventObject:
    """
    完成一些字段的数学计算, 比如 velocity, momentum, sources, keywords 等
    """
    items = cluster.items
    # 抽取来源
    sources = []
    for k,v in items.items():
        sources.append(v.source_meta["platform"])
    sources = list(set(sources))
    
    # 计算keywords
    keywords = extract_keywords(cluster)

    # 计算velocity
    velocity = calculate_velocity(cluster)

    # 为老对象赋值
    new_obj = replace(cluster, keywords=keywords, velocity=velocity, sources=sources) # 产生新对象
    return new_obj

def is_cluster_event(cluster, threshold=3):
    """
    这是一个判定标准：只有 size >= 3 的 cluster 才能称之为 event侯选。
    """
    if cluster.size >= threshold:
        return True
    return False

def extract_keywords(cluster, top_n=5):
    """
    基于纯数学统计的词频（TF-IDF）提取最热门词汇
    避免使用LLM标签，纯客观还原出现频次最多的词。
    """
    items = cluster.items
    texts = [item.content_payload["text"] for item in items.values()]

    if not texts:
        return []
    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=top_n)
        vectorizer.fit(texts)
        return list(vectorizer.get_feature_names_out())
    except ValueError:
        return []



def calculate_velocity(cluster_obj):

    # 时间结构化
    # timestamps = [item.source_meta["ref_ts"] for item in items]
    # first_seen = min(timestamps) if timestamps else 0
    # last_seen = max(timestamps) if timestamps else 0
    # time_span = max(0, last_seen - first_seen)
    time_span = cluster_obj.time_span

    # 计算velocity
    velocity = round(cluster_obj.size / max(time_span, 60), 4)
    return velocity


def calculate_momentum(cluster_obj):
    """
    计算动量：
    - 基础分：基于事件规模（size）
    - 衰减项：基于时间跨度（time_span），时间越长，动量越低
    - 权重：可以根据业务调整 time_decay 的系数
    """
    size = cluster_obj.size
    time_span = cluster_obj.time_span
    
    # 简单的衰减函数：1 / (1 + time_span)，确保结果在 0~1 之间
    # time_span 越大，衰减越明显
    time_decay = 1 / (1 + time_span)
    
    # 动量 = 规模 * 衰减
    momentum = size * time_decay
    
    return round(momentum, 4)

## 策略接口，动态参数，可定制
def strategy_update(db_path, new_cluster_obj, **metrics):
    """
    场景：后续多次调用进行状态演算
    参数：metrics 可以是 velocity=0.4, level=3, status='active' 等任意派生指标
    """
    if not metrics:
        return
    
    for key, value in metrics.items():
        threshold = value
        last_cluster_event = query_event(db_path, new_cluster_obj.cluster_id)
        old_momentum = 0
        old_level = 0
        old_velocity = 0
        if last_cluster_event is not None:
            old_momentum = last_cluster_event["momentum"]
            old_level = last_cluster_event["level"]
            old_velocity = last_cluster_event["velocity"]
        if key == "momentum":
            new_momentum = calculate_momentum(new_cluster_obj)
            metrics[key] = new_momentum
            if new_momentum > threshold and metrics["level"] < 5:
                metrics["level"] += 1
            if new_momentum < threshold and metrics["level"] > 1:
                metrics["level"] -= 1
            if new_momentum > old_momentum and old_level >=2 and old_level < 5:
                metrics["status"] = "active"
            else:
                metrics["status"] = "hold"
                
        elif key == "velocity":
           
            new_velocity = calculate_velocity(new_cluster_obj)
            metrics[key] = new_velocity
            if new_velocity > threshold and metrics["level"] < 5:
                metrics["level"] += 1
                metrics["status"] = "active"
            elif new_velocity > old_velocity and old_level >=2 and old_level < 5:
                metrics["status"] = "actvie"
            elif old_level > 5:
                metrics["status"] = "hot"
            else:
                metrics["status"] = "hold"
        elif key == "last_seen":
            metrics[key] = int(time.time())

    return metrics

