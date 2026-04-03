// Pre-filtering rules for market-moving events.
// Based on `src/Pre-Compression/pre_filter.md`:
// - Trigger workflow only when event impact_score > threshold

function preFilter(event, threshold = 20) {
  if (!event) return null;

  const impactScore = Number(event.impact_score ?? event.impactScore ?? 0);
  const t = Number(threshold);

  if (!Number.isFinite(impactScore)) return null;

  return impactScore > t ? event : null;
}

module.exports = { preFilter };

