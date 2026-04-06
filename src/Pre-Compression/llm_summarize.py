def llm_summarize(event_obj):
    """
    在这里，我们在预处理管线的末端仅把 LLM 当做 Bool 过滤器。
    它负责看一眼 event_obj，给出一个 True (保留并传给 Expert agent) 或 False (丢弃)。
    不额外增加 subjective tags，仅限于抛光候选事件集。
    """
    text = event_obj.get("centroid_text", "").lower()
    
    # --- 这是一个本地的模拟返回，供日后被替换成真正的 Remote API ---
    # prompt = f"Is this news market moving? REPLY True or False.\n {text}"
    # return True in LLM_Client.call(prompt)
    
    # 假设这已经是高价值的候选事件了
    return True