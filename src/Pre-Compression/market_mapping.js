// Market mapping rules.
// For now we implement a light heuristic mapping that aligns with:
// - `src/Pre-Compression/market-mapping.md` (event taxonomy -> candidate assets)

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function marketMapping(event) {
  if (!event) return null;

  const eventType = String(event.event_type ?? '');
  const authoritySignal = Boolean(event.authority_signal);
  const impactScore = Number(event.impact_score ?? 0);

  // Heuristic mapping based on the taxonomy name.
  let candidate_assets = [];
  const normalized = eventType.toLowerCase();

  if (normalized.includes('policy')) {
    candidate_assets = ['compliance', 'ai_regulation', 'affected_tech_industry'];
  } else if (normalized.includes('supply')) {
    candidate_assets = ['logistics', 'supply_chain', 'commodities'];
  } else if (normalized.includes('demand')) {
    candidate_assets = ['consumer', 'demand_recovery', 'retail'];
  } else if (normalized.includes('liquidity')) {
    candidate_assets = ['banking', 'funding', 'rates'];
  } else if (normalized.includes('reputation')) {
    candidate_assets = ['brand', 'public_relations', 'reputation_risk'];
  } else if (normalized.includes('technology')) {
    candidate_assets = ['innovation', 'semiconductors', 'platforms'];
  } else if (normalized.includes('macro')) {
    candidate_assets = ['macro_assets', 'rates', 'fx'];
  } else if (normalized.includes('social')) {
    candidate_assets = ['consumer_brands', 'social_platforms', 'meme_assets'];
  } else if (normalized.includes('capital')) {
    candidate_assets = ['capital_flow', 'markets', 'liquidity_events'];
  } else {
    candidate_assets = ['general_market'];
  }

  // Produce a confidence score in [0,1] for downstream agents.
  // - authority_signal pushes confidence up a bit
  // - impact_score is scaled to max 1 by dividing 100
  const confidence_score = clamp01((authoritySignal ? 0.15 : 0.05) + impactScore / 100 * 0.85);

  // Output structure designed for later agents.
  // (Matches the `market-mapping.md` idea: event_brief.md + candidate_assets.json + confidence_score)
  return {
    event_brief: {
      event: event.event,
      event_type: event.event_type,
      participants: event.participants,
      topic_acceleration: event.topic_acceleration,
      authority_signal: event.authority_signal,
      cross_platform: event.cross_platform,
      impact_score: event.impact_score,
      source: event.source ?? null,
      evidence: event.evidence ?? null,
    },
    candidate_assets,
    confidence_score,
  };
}

module.exports = { marketMapping };

