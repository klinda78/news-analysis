import json
import os
import time
import uuid
import random

def generate_mock_data():
    base_dir = r"d:\onedriver\OneDrive\myproject\news-analysis\src\memory"
    os.makedirs(base_dir, exist_ok=True)
    filepath = os.path.join(base_dir, "rawdata_04012026.jsonl")
    
    current_time = int(time.time())
    
    events = [
        # Event 1: TSMC Factory (Valid, >= 3 messages)
        "TSMC announces new 2nm fab in Arizona, expanding US footprint.",
        "Taiwan Semiconductor Manufacturing Co to build a new factory in Arizona for 2nm chips.",
        "Breaking: TSMC confirms $20B investment for a new US facility.",
        "TSMC Arizona plant to start 2nm production by 2028, sources say.",
        "US subsidies help TSMC build another cutting-edge semiconductor plant in Arizona.",
        "TSMC expanding production! 2nm plant in USA confirmed.",
        
        # Event 2: Fed Rate Cut (Valid, > 3 messages)
        "Federal Reserve cuts interest rates by 25 basis points.",
        "Fed slashes rates by 0.25%, markets react positively.",
        "Jerome Powell announces a quarter-point rate cut at latest FOMC meeting.",
        "Interest rates dropped by 0.25% by the Federal Reserve.",
        "The Fed finally cuts rates, lowering borrowing costs.",
        
        # Event 3: Middle East Conflict (Valid, > 3 messages)
        "Oil prices surge past $90 as Middle East tensions escalate.",
        "Escalation in the Middle East sends Brent crude over $90 a barrel.",
        "Geopolitical risks in the Mideast cause oil shock, prices jump to $92.",
        "Crude oil hits new highs today due to ongoing Middle East conflict.",
        
        # Short Noise (<20 chars)
        "Hello!",
        "This is bad.",
        "Wow, just wow.",
        "Sell everything now.",
        "Market is open.",
        "Good morning.",
        "What a day.",
        
        # No entity Noise (Random generic statements)
        "The weather is very nice outside today, maybe I should go for a walk.",
        "Someone just bought a massive amount of coffee at the local shop.",
        "I can't believe how expensive apples are getting these days.",
        "Looking forward to the weekend so I can finally rest.",
        "My dog ate my homework again, what a disaster.",
    ]
    
    # Exact Duplicates
    exact_duplicates = [
        "Gold reaches new all-time high of $2400 per ounce.",
        "Gold reaches new all-time high of $2400 per ounce.",
        "Gold reaches new all-time high of $2400 per ounce.",
        "Gold reaches new all-time high of $2400 per ounce.",
        "Gold reaches new all-time high of $2400 per ounce.",
    ]
    
    sources_list = ["twitter", "bbc", "reuters", "bloomberg", "reddit"]
    
    data = []
    
    # Add structured events
    for _ in range(100):
        # Pick randomly to simulate a stream
        r = random.random()
        if r < 0.5:
            text = random.choice(events)
        elif r < 0.7:
            text = random.choice(exact_duplicates)
        elif r < 0.85:
            text = "Too short."
        else:
            text = "It is raining heavily in my town today, no one is outside playing." # No entity
            
        record = {
            "id": str(uuid.uuid4()),
            "text": text,
            "timestamp": current_time - random.randint(10, 3600),
            "source": random.choice(sources_list),
            "author": "user_" + str(random.randint(100, 999))
        }
        data.append(record)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        for d in data:
            f.write(json.dumps(d) + "\n")
            
    print(f"Generated 100 mock records at {filepath}")

if __name__ == '__main__':
    generate_mock_data()
