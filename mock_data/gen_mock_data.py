import json
import os
import time
import uuid
import random
from datetime import datetime

# Topics to pass filter
TOPICS = [
    "TSMC says its Arizona fab is meeting production targets for 2nm chips.",
    "Federal Reserve expected to cut rates by 25bps in June FOMC meeting.",
    "Apple unveils new M5 Ultra chip with advanced AI processing capabilities.",
    "Oil prices jump as tensions escalate in the Middle East region.",
    "China economic data shows stronger-than-expected growth in Q1 2026.",
    "Gold prices hit record high of $2500 as investors seek safety.",
    "Sam Altman discusses regulatory challenges for AI superintelligence.",
    "Nvidia market cap surpasses Microsoft to become the world's largest company.",
    "US Election 2026: Polls show tight race in swing states.",
    "FOMC minutes suggest maintain interest rates at current levels."
]

def generate_x_records(count, current_time):
    records = []
    for i in range(count):
        text = random.choice(TOPICS) + " #" + str(uuid.uuid4())[:4]
        ts = current_time - random.randint(0, 3600 * 24 * 2)
        record = {
            "text": text,
            "time": datetime.fromtimestamp(ts).isoformat() + ".000Z",
            "link": f"https://x.com/user/status/{random.randint(10**18, 2*10**18)}",
            "source_url": "https://x.com/news_bot",
            "crawled_at": datetime.fromtimestamp(current_time).isoformat() + ".000Z",
            "platform": "x"
        }
        records.append(record)
    return records

def generate_google_records(count, current_time):
    records = []
    for i in range(count):
        text = random.choice(TOPICS) + " " + str(uuid.uuid4())[:8]
        ts = current_time - random.randint(0, 3600 * 24 * 2)
        item_id = str(uuid.uuid4())
        record = {
            "_id": item_id,
            "_source": "google",
            "_crawled_at": datetime.fromtimestamp(current_time).isoformat() + "Z",
            "id": item_id,
            "text": text,
            "timestamp": ts,
            "source": "google_news_finance"
            # Note: link is missing in archive examples for Google, 
            # though standardized_tool.py looks for it. 
            # Adding it here to be safe but keeping the structure minimal.
            # "link": f"https://news.google.com/articles/{uuid.uuid4()}"
        }
        records.append(record)
    return records

def generate_polymarket_records(count, current_time):
    records = []
    for i in range(count):
        text = f"Polymarket: Will {random.choice(['Fed', 'Apple', 'Tesla', 'TSMC'])} succeed? (Yes: {random.randint(1, 99)}%)"
        ts = current_time - random.randint(0, 3600 * 24 * 2)
        item_id = str(uuid.uuid4())
        record = {
            "_id": item_id,
            "_source": "polymarket",
            "_crawled_at": datetime.fromtimestamp(current_time).isoformat() + "Z",
            "id": item_id,
            "text": text,
            "timestamp": ts,
            "source": "polymarket_forecast"
        }
        records.append(record)
    return records

def main():
    root_dir = r"d:\onedriver\OneDrive\myproject\news-analysis"
    memory_dir = os.path.join(root_dir, "data", "memory")
    os.makedirs(memory_dir, exist_ok=True)
    
    current_time = int(time.time())
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Task: 100 per source, separate files
    jobs = [
        ("x", generate_x_records),
        ("google", generate_google_records),
        ("polymarket", generate_polymarket_records)
    ]
    
    for platform, generator in jobs:
        filename = f"rawdata_{platform}_{date_str}.jsonl"
        filepath = os.path.join(memory_dir, filename)
        
        records = generator(100, current_time)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        
        print(f"Generated 100 records for {platform} at {filepath}")

if __name__ == "__main__":
    main()
