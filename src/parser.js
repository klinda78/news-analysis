 function parser(rawData, source) {
    switch (source.type) 
    {
    case 'twitter':
        return {
            "event": "AI监管讨论升温",
            "participants": ["Elon Musk", "Sam Altman"],
            "topic_acceleration": "high",
            "authority_signal": true,
            "cross_platform": true
        }
    case 'google':
        return {
            "event": "AI监管讨论升温",
            "participants": ["Elon Musk", "Sam Altman"],
            "topic_acceleration": "high",
            "authority_signal": true,
            "cross_platform": true
        }
    case 'bilibili':
        return {
            "event": "AI监管讨论升温",
            "participants": ["Elon Musk", "Sam Altman"],
            "topic_acceleration": "high",
            "authority_signal": true,
            "cross_platform": true
        }
    case 'taobao':
        return {
            "event": "AI监管讨论升温",
            "participants": ["Elon Musk", "Sam Altman"],
            "topic_acceleration": "high",
            "authority_signal": true,
            "cross_platform": true
        }
    return null;     
    }
}