# standardized_event.py
# adapt to the raw data and transform to the event object
from models import EventObject
import hashlib
import time, os,time,datetime
# 定义 7 天的秒数
SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60
class StandardizedEvent:
    def __init__(self, file_path):
        # 1. 从路径中提取文件名，例如 "x_20260417.jsonl"
        self.raw_ref = os.path.basename(file_path)
        
        # 2. 约定：文件名第一个下划线前的内容为 source_id
        # 如果解析失败，默认设为 'generic'
        try:
            self.source_id = self.raw_ref.split('_')[0].lower()
        except Exception:
            self.source_id = 'generic'

    def transform(self, raw_item: dict) -> EventObject:
        """
        根据初始化的 source_id 执行不同的分发逻辑
        """
        item = None
        match self.source_id:
            case 'x' | 'twitter':
                item = self._from_x(raw_item)
            case 'google':
                item = self._from_google(raw_item)
            case 'polymarket':
                item = self._from_polymarket(raw_item)
            case 'reddit':
                item = self._from_reddit(raw_item)
            case _:
                item = self._from_generic(raw_item)
        if self._filter_time_inrange(item) :
            return item
        return None

    def _get_ref_ts(self,item):
        # 1. 优先级提取
        raw_time = item.get('time') or item.get('timestamp') or item.get('crawled_at')
        
        # 2. 默认值：当前时间戳（整数）
        ref_ts = int(time.time()) 

        if raw_time:
            # 情况 A：已经是数字（整数或浮点数时间戳）
            if isinstance(raw_time, (int, float)):
                return int(raw_time)
            
            # 情况 B：是字符串（ISO 格式或 UTC 字符串）
            if isinstance(raw_time, str):
                try:
                    # 处理 X 的 "Z" 后缀和毫秒
                    clean_time = raw_time.replace('Z', '+00:00')
                    # fromisoformat 只能处理某些特定位数的毫秒，
                    # 如果报错，说明格式太复杂，需要更强大的解析
                    dt = datetime.fromisoformat(clean_time)
                    ref_ts = int(dt.timestamp())
                except Exception:
                    # 如果解析失败，可以在这里尝试更宽泛的解析，或者保持兜底
                    pass         
        return ref_ts

    def _filter_time_inrange(self,item):
        ref_ts = item.get('ref_ts') 
        current_ts = int(time.time())
        
        # 7天有效性检查
        time_diff = current_ts - ref_ts
        
        # 逻辑：如果是未来的时间（时间错位）或者超过 7 天
        if time_diff < 0 or time_diff > SEVEN_DAYS_SECONDS:
            item.ref_ts = None
            return False  # 或者标记为低优先级

        return True

    def _from_google(self, item):
        # 针对 Google 的逻辑：使用 link 作为唯一 ID 的基准
        link = item.get('link', '')
        event_id = hashlib.md5(link.encode()).hexdigest()

        ref_ts = self._get_ref_ts(item)
        return EventObject(
            event_id=event_id,
            source_meta={
                "platform": "google",
                "raw_ref": self.raw_ref,
                "original_id": link.split('/')[-1] if '/' in link else "",
                "ref_ts": ref_ts
            },
            content_payload={
                "text": item.get('text', ''),
                "clean_text": "" # 留给后续 NLP 模块填充
            },
            # 初始指标全部留空或设为默认值
            math_metrics={"velocity": 0.0, "momentum": 0.0, "occurrence_count": 1},
            status_track={"level": 1, "is_new": True, "tags": []}
        )
    def _from_polymarket(self, item):
        # 针对 Polymarket 的逻辑：使用 link 作为唯一 ID 的基准
        link = item.get('link', '')
        event_id = hashlib.md5(link.encode()).hexdigest()

        ref_ts = self._get_ref_ts(item)
        return EventObject(
            event_id=event_id,
            source_meta={
                "platform": "polymarket",
                "raw_ref": self.raw_ref,
                "original_id": link.split('/')[-1] if '/' in link else "",
                "ref_ts": ref_ts
            },
            content_payload={
                "text": item.get('text', ''),
                "clean_text": "" # 留给后续 NLP 模块填充
            },
            # 初始指标全部留空或设为默认值
            math_metrics={"velocity": 0.0, "momentum": 0.0, "occurrence_count": 1},
            status_track={"level": 1, "is_new": True, "tags": []}
        )
    def _from_x(self, item):
        # 针对 X 的逻辑：使用 link 作为唯一 ID 的基准
        link = item.get('link', '')
        event_id = hashlib.md5(link.encode()).hexdigest()

        ref_ts = self._get_ref_ts(item)
        return EventObject(
            event_id=event_id,
            source_meta={
                "platform": "x",
                "raw_ref": self.raw_ref,
                "original_id": link.split('/')[-1] if '/' in link else "",
                "ref_ts": ref_ts
            },
            content_payload={
                "text": item.get('text', ''),
                "clean_text": "" # 留给后续 NLP 模块填充
            },
            # 初始指标全部留空或设为默认值
            math_metrics={"velocity": 0.0, "momentum": 0.0, "occurrence_count": 1},
            status_track={"level": 1, "is_new": True, "tags": []}
        )

    def _from_reddit(self, item):
        # 针对 Reddit 的逻辑：直接使用它的 id

        return EventObject(
            event_id=item.get('id', ''),
            source_meta={
                "platform": "reddit",
                "raw_ref": self.raw_ref,
                "original_id": item.get('id', '')
            },
            content_payload={
                "text": item.get('text', ''),
                "clean_text": ""
            },
            math_metrics={"velocity": 0.0, "momentum": 0.0, "occurrence_count": 1},
            status_track={"level": 1, "is_new": True, "tags": []}
        )

    def _from_generic(self, item):
        # 兜底逻辑
        text = item.get('text', '')
        event_id = hashlib.md5(text[:50].encode()).hexdigest()
        return EventObject(event_id=event_id, content_payload={"text": text})