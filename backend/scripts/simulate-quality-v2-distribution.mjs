/**
 * DH-PIPELINE-P4 — read-only v1 vs v2 distribution on last N processed rows (no DB writes).
 */
import { query } from '../database/db.js';
import { scoreNormalizedRecord, scoreNormalizedRecordV1 } from '../services/normalizationQualityScorer.js';
import { scoreNormalizedRecordV2 } from '../services/normalizationQualityScorerV2.js';

const LIMIT = Number(process.env.SAMPLE_LIMIT || 500);

function stats(scores) {
  if (!scores.length) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.floor((p / 100) * (sorted.length - 1))];
  return {
    n: scores.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
    median: pct(50),
    p10: pct(10),
    p25: pct(25),
    p75: pct(75),
    p90: pct(90),
    distinct: new Set(scores).size,
    buckets: {
      '0-25': scores.filter((s) => s <= 25).length,
      '26-50': scores.filter((s) => s > 25 && s <= 50).length,
      '51-75': scores.filter((s) => s > 50 && s <= 75).length,
      '76-100': scores.filter((s) => s > 75).length,
    },
  };
}

function topScores(scores, n = 10) {
  const freq = new Map();
  for (const s of scores) freq.set(s, (freq.get(s) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

async function main() {
  const result = await query(
    `SELECT cd.normalized_data, cd.raw_data, ds.type AS source_type, ds.priority,
            ds.is_active, ds.last_status, cd.collected_at,
            (SELECT COUNT(*)::int FROM collected_data err
             WHERE err.source_id = cd.source_id AND err.status = 'error') AS source_error_count
     FROM collected_data cd
     JOIN data_sources ds ON ds.id = cd.source_id
     WHERE cd.status = 'processed' AND cd.normalized_data IS NOT NULL
     ORDER BY cd.processed_at DESC NULLS LAST
     LIMIT $1`,
    [LIMIT],
  );

  const v1Scores = [];
  const v2Scores = [];
  const examples = [];

  for (const row of result.rows) {
    const normalized = row.normalized_data;
    const ctx = {
      is_active: row.is_active,
      last_status: row.last_status,
      priority: row.priority,
      source_error_count: row.source_error_count,
      collected_at: row.collected_at,
      source_type: row.source_type,
    };
    const oldMeta = normalized?.metadata?.quality_score;
    const v1 = scoreNormalizedRecordV1(normalized, ctx);
    const v2 = scoreNormalizedRecordV2(normalized, ctx);
    v1Scores.push(oldMeta != null ? Number(oldMeta) : v1.score);
    v2Scores.push(v2.score);

    if (examples.length < 8 && Math.abs(v2.score - v1.score) >= 10) {
      examples.push({
        old: oldMeta ?? v1.score,
        v2: v2.score,
        reasons: v2.reasonCodes.slice(0, 6),
        preview: String(normalized?.content || '').slice(0, 80),
      });
    }
  }

  const report = {
    task: 'DH-PIPELINE-P4-SCORING-CALIBRATION-1',
    sampleSize: LIMIT,
    v1_stored_or_resimulated: stats(v1Scores),
    v2_resimulated: stats(v2Scores),
    v1_top_scores: topScores(v1Scores),
    v2_top_scores: topScores(v2Scores),
    variance_improved: stats(v2Scores).distinct > stats(v1Scores).distinct,
    examples,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
