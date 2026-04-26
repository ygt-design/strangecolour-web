const VALID_ALIGNS = ["start", "center", "end"];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function sumArr(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// ─── v3 validation ───────────────────────────────────────

function isValidV3Row(r) {
  if (!r || typeof r !== "object") return false;
  if (!Array.isArray(r.spans) || r.spans.length === 0) return false;
  if (!r.spans.every((s) => Number.isInteger(s) && s >= 1 && s <= 12))
    return false;
  if (typeof r.offset !== "number" || r.offset < 0) return false;
  if (!VALID_ALIGNS.includes(r.align)) return false;
  return true;
}

// ─── v2 validation (for migration) ──────────────────────

function isValidV2Row(r) {
  if (!r || typeof r !== "object") return false;
  if (r.count !== 1 && r.count !== 2) return false;
  if (!Array.isArray(r.spans) || r.spans.length !== r.count) return false;
  if (!r.spans.every((s) => Number.isInteger(s) && s >= 1 && s <= 12))
    return false;
  if (!Array.isArray(r.starts) || r.starts.length !== r.count) return false;
  if (!r.starts.every((s) => Number.isInteger(s) && s >= 0)) return false;
  if (!VALID_ALIGNS.includes(r.align)) return false;
  return true;
}

function migrateV2Row(r) {
  const offset = Math.min(...r.starts);
  return clampPackedRow({
    offset,
    spans: r.spans,
    align: r.align,
  });
}

// ─── Parse / serialize ──────────────────────────────────

export function parseLayoutConfig(text) {
  try {
    const obj = JSON.parse(text);
    if (!Array.isArray(obj.rows) || obj.rows.length === 0) return null;

    if (obj.version === 3) {
      if (!obj.rows.every(isValidV3Row)) return null;
      return { version: 3, rows: obj.rows.map((r) => clampPackedRow(r)) };
    }

    if (obj.version === 2) {
      if (!obj.rows.every(isValidV2Row)) return null;
      return { version: 3, rows: obj.rows.map(migrateV2Row) };
    }

    return null;
  } catch {
    return null;
  }
}

export function serializeLayoutConfig(rows) {
  return JSON.stringify({ version: 3, rows }, null, 2);
}

// ─── Row helpers ────────────────────────────────────────

export function clampPackedRow(row, totalCols = 12) {
  const spans = row.spans.map((s) => clamp(s, 1, totalCols));
  let total = sumArr(spans);
  while (total > totalCols && spans.length > 0) {
    const last = spans.length - 1;
    const over = total - totalCols;
    if (spans[last] > over) {
      spans[last] -= over;
      total -= over;
    } else {
      total -= spans[last];
      spans[last] = 1;
      total += 1;
    }
  }
  const offset = clamp(row.offset ?? 0, 0, totalCols - sumArr(spans));
  return {
    offset,
    spans,
    align: VALID_ALIGNS.includes(row.align) ? row.align : "end",
  };
}

export function rowToStarts(row) {
  const starts = [];
  let col = row.offset;
  for (const span of row.spans) {
    starts.push(col);
    col += span;
  }
  return starts;
}

export function rowToBlocks(row, totalCols = 12) {
  const clamped = clampPackedRow(row, totalCols);
  const starts = rowToStarts(clamped);
  return clamped.spans.map((span, i) => ({ start: starts[i] + 1, span }));
}

export function scaleRow(row, targetCols, sourceCols = 12) {
  const ratio = targetCols / sourceCols;
  const scaledSpans = row.spans.map((s) => Math.max(1, Math.round(s * ratio)));
  const scaledOffset = Math.round(row.offset * ratio);
  return clampPackedRow(
    { offset: scaledOffset, spans: scaledSpans, align: row.align },
    targetCols,
  );
}

// ─── Legacy compat ──────────────────────────────────────

function parsePattern(str) {
  const arr = str.split(",").map((s) => parseInt(s.trim(), 10));
  return arr.every((n) => !Number.isNaN(n)) && arr.length > 0 ? arr : null;
}

export function normalizeLegacyRows(rowPattern, shiftPattern, totalCols = 12) {
  const len = Math.max(rowPattern.length, shiftPattern.length);
  return Array.from({ length: len }, (_, i) => {
    const count = rowPattern[i % rowPattern.length];
    const shift = shiftPattern[i % shiftPattern.length];
    const spans = count === 1 ? [4] : [4, 4];
    const half = totalCols / 2;
    let offset;
    if (count === 1) {
      offset = clamp(
        Math.floor((totalCols - spans[0]) / 2) + shift,
        0,
        totalCols - spans[0],
      );
    } else {
      offset = clamp(
        Math.floor(half) + shift - spans[0],
        0,
        totalCols - sumArr(spans),
      );
    }
    return clampPackedRow({ offset, spans, align: "end" }, totalCols);
  });
}

export function rowToLegacyShift(row, totalCols = 12) {
  const total = sumArr(row.spans);
  const centered = Math.floor((totalCols - total) / 2);
  return row.offset - centered;
}

export { parsePattern };
