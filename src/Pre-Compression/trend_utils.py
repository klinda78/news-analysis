# trend_utils.py (你的算法逻辑，和event_engine解耦,包含一个跟踪cluster event事件状态的函数)
import time
import sqlite3
from event_engine import EventEngine

def calculate_momentum(event):
    """
    你的数学改良算法落地处
    event: 这是一个从数据库捞出来的字典或对象
    """
    pass
    

def calculate_velocity(event):
    """
    你的数学改良算法落地处
    event: 这是一个从数据库捞出来的字典或对象
    """
    current_ts = int(time.time())
    # 确保分母不为 0
    time_span = current_ts - event['first_seen']
    # 这里的 size 可以是你在聚类阶段统计到的 occurrence_count
    velocity = round(event['size'] / max(time_span, 60), 4)
    return velocity

def query_event(db_path,event_id):
    with sqlite3.connect(db_path) as conn:
        conn.execute("""
            SELECT * FROM candidate_events WHERE event_id = ?
        """, (event_id,))
        return conn.fetchone()


async def track_trends():  # 这是一个示例函数，你可以根据自己的需求进行修改
    # EventEngine
    engine = EventEngine()
    
    # 获取当前所有处于活跃状态的候选事件 (candidate_events)
    active_cluster_events = engine.get_active_events()
    
    for cluster_event in active_cluster_events:
  
        # 到数据库查询 event 的最新情况
        sql_query = f' SELECT * FROM candidate_events WHERE cluster_id = ?'
        with sqlite3.connect(engine.db_path) as conn:
            conn.execute(sql_query, (cluster_event['cluster_id'],))
            event = conn.fetchone()
        
            print(f"追踪更新: Event {cluster_event['cluster_id']}" + "\n" + event['status'] + "\n" + event['velocity'] + "\n" +event['level'])  

    return active_cluster_events