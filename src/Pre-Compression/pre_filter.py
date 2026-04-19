import hashlib
import sqlite3
import os

ENTITY_KEYWORDS = {
    "tsmc", "semiconductor", "apple", "fed", "federal reserve", 
    "interest rate", "oil", "crude", "middle east", "gold", 
    "china", "usa", "europe", "election", "market", "stock", "company",
    "fomc", "powell", "geopolitical", "chip", "economy"
}

class SQLiteDeduplicator:
    def __init__(self, db_path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS processed_hashes (
                    hash TEXT PRIMARY KEY
                )
            """)
            conn.commit()

    def is_new(self, hash_val):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT 1 FROM processed_hashes WHERE hash = ?", (hash_val,))
            return cursor.fetchone() is None
    ## save hash to db table: processed_hashes
    def mark_as_processed(self, hash_val):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("INSERT INTO processed_hashes (hash) VALUES (?)", (hash_val,))
                conn.commit()
        except sqlite3.IntegrityError:
            pass # Already exists


def is_valid(text):
    if len(text) < 20:
        return False
        
    text_lower = text.lower()
    has_entity = False
    for kw in ENTITY_KEYWORDS:
        if kw in text_lower:
            print(f"[Keyword Found] {kw} in {text}")
            has_entity = True
            break
            
    if not has_entity:
        return False
        
    return True

def get_hash(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def filter_raw_data(raw_data_list, db_path=None):
    """
    过滤垃圾信息、无实体片段及精准去重（支持 SQLite 持久化）
    """
    valid_data = []
    # 内存中的 set 用于在同一个批次内快速去重
    seen_in_batch = set()
    
    deduplicator = None
    if db_path:
        deduplicator = SQLiteDeduplicator(db_path)
    
    for item in raw_data_list: # raw_data_list is a list of EventObject
        text = item.content_payload.get("text", "")
        h = item.event_id
        # 1. 批次内去重
        if h in seen_in_batch:
            continue
        # 2. 数据有效否
        if not is_valid(text):
            continue
        # 3. 持久化去重 (与数据库对比)
        if deduplicator and not deduplicator.is_new(h):
            continue

        seen_in_batch.add(h)
        # 只有通过了静态过滤的内容，才算作“已处理”，并入库 hash值，但event对象其他字段不入库
        deduplicator.mark_as_processed(h)
        valid_data.append(item)
            
    return valid_data
