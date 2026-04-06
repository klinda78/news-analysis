import hashlib

ENTITY_KEYWORDS = {
    "tsmc", "semiconductor", "apple", "fed", "federal reserve", 
    "interest rate", "oil", "crude", "middle east", "gold", 
    "china", "usa", "europe", "election", "market", "stock", "company",
    "fomc", "powell", "geopolitical", "chip", "economy"
}

def is_valid(text):
    if len(text) < 20:
        return False
        
    text_lower = text.lower()
    has_entity = False
    for kw in ENTITY_KEYWORDS:
        if kw in text_lower:
            has_entity = True
            break
            
    if not has_entity:
        return False
        
    return True

def get_hash(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def filter_raw_data(raw_data_list):
    """
    过滤垃圾信息、无实体片段及精准去重
    """
    valid_data = []
    seen_hashes = set()
    
    for item in raw_data_list:
        text = item.get("text", "")
        h = get_hash(text)
        if h in seen_hashes:
            continue
            
        if is_valid(text):
            seen_hashes.add(h)
            valid_data.append(item)
            
    return valid_data
