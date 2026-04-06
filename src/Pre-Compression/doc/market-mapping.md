## 这是news-agent的思维模式,不需要代码实现
### mission
Detect market-moving events early.

### event taxonomy
Policy
Supply Shock
Demand Shock
Accident / Disaster
Corporate Action
Technology Breakthrough
Social Trend
Capital Flow

### event → asset mapping rules
Energy crisis -> Oil / LNG / Coal / Shipping
Heat wave -> Electricity / AC / Utilities
War -> Commodities / Defense
Policy ban -> Industry supply chain
Celebrity effect -> Meme coins / consumer brands
Platform policy -> traffic redistribution

### event scoring
impact_score =
    asset_relevance
    geographic_scale
    urgency
    capital involvement
    supply disruption probability

### output format
event_summary.md
candidate_assets.json(optional)
confidence_score(optional)