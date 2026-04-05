from sklearn.cluster import DBSCAN
import numpy as np
from sklearn.metrics.pairwise import cosine_distances
import uuid
import requests
import os

# 后续你可以把 API KEY 放在 config.json 里，目前先从环境变量读取或者在此暂定硬编码
ZHIPU_API_KEY = os.environ.get("ZHIPU_API_KEY", "your_api_key_here")  

def get_zhipu_embeddings(texts):
    """
    使用智谱 API (embedding-3) 获取向量。
    文档限制：单次请求最多支持 64 条输入。
    """
    if not ZHIPU_API_KEY or ZHIPU_API_KEY == "your_api_key_here":
        raise ValueError("请首先配置 ZHIPU_API_KEY。")

    url = "https://open.bigmodel.cn/api/paas/v4/embeddings"
    headers = {
        "Authorization": f"Bearer {ZHIPU_API_KEY}",
        "Content-Type": "application/json"
    }
    
    all_embeddings = []
    chunk_size = 64
    
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i+chunk_size]
        payload = {
            "model": "embedding-3",
            "input": chunk,
            "dimensions": 1024 # 可以选择降维以加速后续计算
        }
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            res_data = response.json()
            # 保证顺序正确
            sorted_data = sorted(res_data["data"], key=lambda x: x["index"])
            chunk_embeddings = [np.array(item["embedding"]) for item in sorted_data]
            all_embeddings.extend(chunk_embeddings)
        else:
            raise Exception(f"Zhipu API 调用失败: {response.status_code} - {response.text}")
            
    return np.array(all_embeddings)

def cluster_texts(valid_data):
    """
    通过云端获取向量，本地执行纯数学DBSCAN距离聚类
    """
    if not valid_data:
        return []
        
    texts = [item['text'] for item in valid_data]
    
    # 彻底告别本地庞大的 PyTorch 和模型库开销
    print(f"正在通过智谱API拉取 {len(texts)} 条文本向量...")
    embeddings = get_zhipu_embeddings(texts)
    
    # 利用余弦距离获得点与点之间的关系
    dist_matrix = cosine_distances(embeddings)
    
    # DBSCAN 进行密集聚类。由于智谱的 embedding-3 的向量分布极为凝练，
    # eps = 0.3 到 0.4 通常是一个极其有效的分野点 (也就是两段话相似度大约在 0.6~0.7)
    clustering = DBSCAN(eps=0.3, min_samples=2, metric='precomputed').fit(dist_matrix)
    labels = clustering.labels_
    
    clusters = {}
    for idx, label in enumerate(labels):
        if label == -1:
            # 离群的噪音（不属于任何事件簇）
            continue
        if label not in clusters:
            clusters[label] = {
                "items": [],
                "embeddings": []
            }
        clusters[label]["items"].append(valid_data[idx])
        clusters[label]["embeddings"].append(embeddings[idx])
        
    cluster_objects = []
    
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
