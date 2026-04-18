# trend_utils.py (你的算法逻辑，和event_engine解耦,包含一个跟踪cluster event事件状态的函数)
import time
import sqlite3

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

