from sentence_transformers import SentenceTransformer
from sklearn.cluster import DBSCAN
import numpy as np
from sklearn.metrics.pairwise import cosine_distances
import uuid

# 全局加载最轻量的模型，确保它能再 16GB 内存下如闪电般执行
model = SentenceTransformer('all-MiniLM-L6-v2')

def cluster_texts(valid_data):
    """
    执行文本向量化和DBSCAN纯数学聚类
    """
    if not valid_data:
        return []
        
    texts = [item['text'] for item in valid_data]
    
    # 纯数学降维成向量
    embeddings = model.encode(texts, convert_to_numpy=True)
    
    # 利用余弦距离获得点与点之间的关系
    dist_matrix = cosine_distances(embeddings)
    
    # DBSCAN 进行密集聚类. eps 设为 0.3（余弦相似度必须>0.7才能是一个事件簇）
    clustering = DBSCAN(eps=0.3, min_samples=2, metric='precomputed').fit(dist_matrix)
    labels = clustering.labels_
    
    clusters = {}
    for idx, label in enumerate(labels):
        if label == -1:
            # 离群的噪声（不属于任何簇）
            continue
        if label not in clusters:
            clusters[label] = {
                "items": [],
                "embeddings": []
            }
        clusters[label]["items"].append(valid_data[idx])
        clusters[label]["embeddings"].append(embeddings[idx])
        
    cluster_objects = []
    
    # 将属于同一类的聚成一个 dict 
    for label, data in clusters.items():
        # 求出中心点坐标（质心）
        mean_embedding = np.mean(data["embeddings"], axis=0)
        
        # 寻找距离质心最近的那条原始文本作为代表作
        dists = cosine_distances([mean_embedding], data["embeddings"])[0]
        centroid_idx = np.argmin(dists)
        centroid_text = data["items"][centroid_idx]["text"]
        
        cluster_obj = {
            "cluster_id": str(uuid.uuid4()),
            "items": data["items"],
            "centroid_text": centroid_text,
            "size": len(data["items"])
        }
        cluster_objects.append(cluster_obj)
        
    return cluster_objects
