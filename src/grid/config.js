/**
 * Grid configuration — single source of truth for layout.
 *
 * Desktop : 12 columns
 * Tablet  : 8 columns  (≤ BREAKPOINT_TABLET)
 * Mobile  : 4 columns  (≤ BREAKPOINT)
 *
 * All pixel values are unitless numbers; append "px" in consuming code.
 * String values (e.g. ROW_GAP) already include their CSS unit.
 */

const BREAKPOINT = "768px";
const BREAKPOINT_TABLET = "1024px";

export const GRID = {
  // ── Desktop ────────────────────────────────────────────────
  /** Number of grid columns on desktop */
  COLUMNS: 12,
  /** Maximum content width (px) */
  MAX_WIDTH: 1800,
  /** Horizontal page padding (px) */
  PADDING: 20,
  /** Column gap / gutter (px) */
  GAP: 20,
  /** Row gap between grid children (CSS value) */
  ROW_GAP: "2rem",

  // ── Tablet (≤ BREAKPOINT_TABLET) ───────────────────────────
  /** Number of grid columns on tablet */
  COLUMNS_TABLET: 8,
  /** Horizontal page padding on tablet (px) */
  PADDING_TABLET: 30,
  /** Column gap on tablet (CSS value) */
  GAP_TABLET: "1rem",
  /** Row gap on tablet (CSS value) */
  ROW_GAP_TABLET: "1.5rem",

  // ── Mobile (≤ BREAKPOINT) ──────────────────────────────────
  /** Number of grid columns on mobile */
  COLUMNS_MOBILE: 4,
  /** Horizontal page padding on mobile (px) */
  PADDING_MOBILE: 20,
  /** Column gap on mobile (CSS value) */
  GAP_MOBILE: "1rem",
  /** Row gap on mobile (CSS value) */
  ROW_GAP_MOBILE: "2.5rem",

  // ── Breakpoints ────────────────────────────────────────────
  /** Mobile breakpoint — max-width media query threshold */
  BREAKPOINT,
  /** Tablet breakpoint — max-width media query threshold */
  BREAKPOINT_TABLET,

  // ── Pre-built media-query strings ──────────────────────────
  /** Use in styled-components: @media ${GRID.MEDIA_MOBILE} { … } */
  MEDIA_MOBILE: `(max-width: ${BREAKPOINT})`,
  /** Use in styled-components: @media ${GRID.MEDIA_TABLET} { … } */
  MEDIA_TABLET: `(max-width: ${BREAKPOINT_TABLET})`,
};

export default GRID;
