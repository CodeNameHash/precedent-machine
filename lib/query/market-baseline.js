function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function numericStats(values) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const n = nums.length;
  if (!n) return { n: 0, min: null, p10: null, p25: null, median: null, p75: null, p90: null, max: null, mean: null, stddev: null };
  const mean = nums.reduce((sum, x) => sum + x, 0) / n;
  const variance = nums.reduce((sum, x) => sum + ((x - mean) ** 2), 0) / n;
  return {
    n,
    min: nums[0],
    p10: quantile(nums, 0.1),
    p25: quantile(nums, 0.25),
    median: quantile(nums, 0.5),
    p75: quantile(nums, 0.75),
    p90: quantile(nums, 0.9),
    max: nums[n - 1],
    mean,
    stddev: Math.sqrt(variance),
  };
}

function frequencyStats(values) {
  const total = values.filter((x) => x !== null && x !== undefined && x !== '').length;
  const counts = new Map();
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, percent: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function histogram(values, bucketCount = 8) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return [];
  const min = nums[0];
  const max = nums[nums.length - 1];
  if (min === max) return [{ bucket_min: min, bucket_max: max, count: nums.length }];
  const width = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    bucket_min: min + width * i,
    bucket_max: i === bucketCount - 1 ? max : min + width * (i + 1),
    count: 0,
  }));
  for (const value of nums) {
    const idx = Math.min(bucketCount - 1, Math.floor((value - min) / width));
    buckets[idx].count += 1;
  }
  return buckets;
}

function scoreValue(value, baseline, kind, nonNullCount, comparisonSetSize) {
  if (value === null || value === undefined || value === '') {
    const rate = comparisonSetSize ? nonNullCount / comparisonSetSize : 0;
    if (rate >= 0.8) return 'MISSING';
    if (rate < 0.2) return 'NOT_APPLICABLE';
    return 'MISSING';
  }
  if (kind === 'numeric') {
    const n = Number(value);
    if (!Number.isFinite(n) || !baseline || !baseline.n) return 'NOT_APPLICABLE';
    if (n >= baseline.p25 && n <= baseline.p75) return 'MARKET';
    if ((n >= baseline.p10 && n < baseline.p25) || (n > baseline.p75 && n <= baseline.p90)) return 'OFF_MARKET';
    return 'UNUSUAL';
  }
  const dist = Array.isArray(baseline) ? baseline : [];
  const topTwo = dist.slice(0, 2).map((x) => String(x.value));
  const found = dist.find((x) => String(x.value) === String(value));
  if (topTwo.includes(String(value))) return 'MARKET';
  if (found && found.count > 1) return 'OFF_MARKET';
  return 'UNUSUAL';
}

module.exports = { quantile, numericStats, frequencyStats, histogram, scoreValue };
