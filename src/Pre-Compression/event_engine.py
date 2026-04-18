import sqlite3
import time
from models import ClusterEventObject
from trend_utils import calculate_momentum, calculate_velocity, query_event

class EventEngine:
    def __init__(self, db_path="events_manager.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化追踪表：支持基础字段 + 预留扩展空间"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS candidate_events (
                    event_id TEXT PRIMARY KEY,
                    platform TEXT,
                    status TEXT,
                    level INTEGER,
                    velocity REAL,
                    first_seen INTEGER,
                    last_update INTEGER,
                    extra_data TEXT  -- 预留位：存储不确定结构的 JSON
                )
            """)
    

    async def track_trends(self):  # 这是一个示例函数，你可以根据自己的需求进行修改
    
        # 获取当前所有处于活跃状态的候选事件 (candidate_events)
        active_cluster_events = self._get_active_events()
        
        for event in active_cluster_events:
            print(f"追踪更新: Cluster Event {event['cluster_id']}" + "\n" + event['status'] + "\n" + event['velocity'] + "\n" +event['level'])  

        return active_cluster_events

    def _get_active_events(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                SELECT * FROM candidate_events WHERE status = 'active'
            """)
            return conn.fetchall()
    def init_persistence(self, item: ClusterEventObject):
        """
        场景：初次发现 Event
        职责：建立追踪索引
        """
        now = int(time.time())

        with sqlite3.connect(self.db_path) as conn:
            # 直接使用 event_obj.event_id，它是我们在标准化阶段敲定的“唯一契约”
            conn.execute("""
                INSERT OR IGNORE INTO events 
                (event_id, platform, size, status, level, velocity, last_update)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                item.event_id, 
                item.source_meta['platform'], 
                item.math_metrics['size'],
                item.status_track['status'], 
                item.status_track['level'],
                item.math_metrics['velocity'], 
                item.math_metrics['momentum'],
                now
            ))
    def is_new(self,cluster_id):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                SELECT * FROM candidate_events WHERE cluster_id = ?
            """, (cluster_id,))
            return conn.fetchone() is None

    def evaluate_status(self, cluster_obj, **metrics):
        """
        场景：后续多次调用进行状态演算
        参数：metrics 可以是 velocity=0.4, level=3, status='active' 等任意派生指标
        """

        if not metrics:
            return
        
        for key, value in metrics.items():
            threshold = value
            last_event = query_event(cluster_obj.event_id)
            if key == "momentum":
                old_momentum = last_event['momentum']
                new_momentum = calculate_momentum(cluster_obj)
                metrics[key] = new_momentum
                if new_momentum > threshold and metrics["level"] < 5:
                    metrics["level"] += 1
                if new_momentum < threshold and metrics["level"] > 1:
                    metrics["level"] -= 1
                if new_momentum > old_momentum and last_event['level'] >=2 and last_event['level'] < 5:
                    metrics["status"] = "active"
                else:
                    metrics["status"] = "hold"
                    
            elif key == "velocity":
                old_velocity = last_event['velocity']
                new_velocity = calculate_velocity(cluster_obj)
                metrics[key] = new_velocity
                if new_velocity > threshold and metrics["level"] < 5:
                    metrics["level"] += 1
                    metrics["status"] = "active"
                elif new_velocity > old_velocity and last_event['level'] >=2 and last_event['level'] < 5:
                    metrics["status"] = "actvie"
                elif last_event['level'] > 5:
                    metrics["status"] = "hot"
                else:
                    metrics["status"] = "hold"
            elif key == "last_seen":
                metrics[key] = int(time.time())



        # 动态构建 SQL 语句，体现“为后续留下空间”
        keys = [f"{k} = ?" for k in metrics.keys()]
        query = f"UPDATE candidate_events SET {', '.join(keys)}, last_update = ? WHERE cluster_id = ?"
        values = list(metrics.values()) + [int(time.time()), cluster_obj.cluster_id]

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(query, values)

