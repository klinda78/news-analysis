from sklearn.feature_extraction.text import TfidfVectorizer
import uuid

def is_event(cluster, threshold=3):
    """
    这是一个判定标准：只有 size >= 3 的 cluster 才能称之为 event侯选。
    """
    if cluster.get("size", 0) >= threshold:
        return True
    return False

def extract_keywords(texts, top_n=5):
    """
    基于纯数学统计的词频（TF-IDF）提取最热门词汇
    避免使用LLM标签，纯客观还原出现频次最多的词。
    """
    if not texts:
        return []
    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=top_n)
        vectorizer.fit(texts)
        return list(vectorizer.get_feature_names_out())
    except ValueError:
        return []

def format_event_obj(cluster):
    """
    将 cluster 转化为严谨符合规范的 8项字段 event_obj
    """
    items = cluster.get("items", [])
    texts = [item.get("text", "") for item in items]
    
    # 抽取来源
    sources = list(set([item.get("source", "unknown") for item in items]))
    
    # 时间结构化
    timestamps = [item.get("timestamp", 0) for item in items]
    first_seen = min(timestamps) if timestamps else 0
    last_seen = max(timestamps) if timestamps else 0
    time_span = max(0, last_seen - first_seen)
    
    keywords = extract_keywords(texts)
    
    event_obj = {
        "event_id": cluster.get("cluster_id", str(uuid.uuid4())),
        "centroid_text": cluster.get("centroid_text", ""),
        "size": cluster.get("size", 0),
        "sources": sources,
        "keywords": keywords,
        "first_seen": first_seen,
        "last_seen": last_seen,
        "time_span": time_span,
        # 严格基于数学规则增加派生指标（例如速率 = 数量/时间）
        "velocity": round(cluster.get("size", 0) / max(time_span, 60), 4)
    }
    
    return event_obj
