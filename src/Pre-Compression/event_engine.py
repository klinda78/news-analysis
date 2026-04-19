import sqlite3
import time
from models import ClusterEventObject
from utils import calculate_momentum, calculate_velocity, query_event
import json
import enrich_calculate as enrich   
from dataclasses import asdict
## 这是核心事务引擎
class EventEngine:
    def __init__(self, db_path="events_manager.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化追踪表：支持基础字段 + 预留扩展空间"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS candidate_events (
                        cluster_id TEXT PRIMARY KEY,
                        centroid_text TEXT,              
                        size INTEGER,                     
                        items_json TEXT,                
                        sources_str TEXT,                     
                        keywords_str TEXT,                 
                        first_seen INTEGER,
                        last_seen INTEGER,
                        time_span INTEGER,
                        last_update INTEGER,
                        velocity REAL,
                        momentum REAL,
                        status TEXT,
                        level INTEGER,
                        extra_data TEXT               
                    )
            """)
    

    @staticmethod
    def track_trends(candidate_events):  # 接收来自 Stage 4 的候选事件列表
        """
        对传入的候选事件列表进行状态追踪，返回仍处于活跃状态的事件。
        """
        active = []
        for event in candidate_events:
            level = getattr(event, 'level', 1) if not isinstance(event, dict) else event.get('level', 1)
            if level >= 1:
                active.append(event)
        return active

    def _get_active_events(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT * FROM candidate_events WHERE status = 'active'
            """)
            return cursor.fetchall()
    def init_persistence(self, item: ClusterEventObject):
        """
        场景：初次发现 Event
        职责：建立追踪索引
        """
        now = int(time.time())
        keywords_str = json.dumps(item.keywords)
        sources_str = json.dumps(item.sources)
        items_json_str = json.dumps({k: asdict(v) for k, v in item.items.items()})

        with sqlite3.connect(self.db_path) as conn:
            # 直接使用cluster_id，它是我们在标准化阶段敲定的“唯一契约”
            conn.execute("""
                INSERT OR IGNORE INTO candidate_events 
                (cluster_id, centroid_text, items_json, keywords_str, size, sources_str, status, level, velocity, momentum, last_update)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item.cluster_id, 
                item.centroid_text,
                items_json_str,
                keywords_str,
                item.size,
                sources_str,
                item.status,
                item.level,
                item.velocity,
                item.momentum,
                now
            ))

    @staticmethod
    def config(db_path):
        EventEngine.db_path = db_path
   
    def is_new(self,cluster_id):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT * FROM candidate_events WHERE cluster_id = ?
            """, (cluster_id,))
            return cursor.fetchone() is None


    ## 策略接口，动态参数，可定制
    def strategy_update(self, cluster_obj, **metrics):
        """
        场景：后续多次调用进行状态演算
        参数：metrics 可以是 velocity=0.4, level=3, status='active' 等任意派生指标
        """
        if not metrics:
            return
        
        for key, value in metrics.items():
            threshold = value
            last_event = query_event(self.db_path, cluster_obj.cluster_id)
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

        return metrics

    
    def update_persistence(self, cluster_obj, **metrics):

     # 动态构建 SQL 语句，体现“为后续留下空间”
        keys = [f"{k} = ?" for k in metrics.keys()]
        query = f"UPDATE candidate_events SET {', '.join(keys)}, last_update = ? WHERE cluster_id = ?"
        values = list(metrics.values()) + [int(time.time()), cluster_obj.cluster_id]
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(query, values)

        # with sqlite3.connect(self.db_path) as conn:
        #     conn.execute("""
        #         UPDATE candidate_events SET 
        #         status = ?, level = ?, velocity = ?, momentum = ?, last_update = ?
        #         WHERE cluster_id = ?
        #     """, (
        #         metrics['status'], 
        #         metrics['level'], 
        #         metrics['velocity'], 
        #         metrics['momentum'], 
        #         int(time.time()), 
        #         cluster_obj.cluster_id
        #     ))

    ## 对cluster类的处理
    def workflow_logic(self, cluster_obj, **trend_metrics):
        if self.is_new(cluster_obj.cluster_id):
            self.init_persistence(cluster_obj)
        else:
            # metrics = self.strategy_update(cluster_obj, **trend_metrics)
            self.update_persistence(cluster_obj, trend_metrics)
        return cluster_obj