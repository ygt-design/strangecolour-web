import { css, createGlobalStyle } from "styled-components";
import citerneRegular from "./assets/fonts/Citerne-Regular.woff2";
import citerneMedium from "./assets/fonts/Citerne-Medium.woff2";
import citerneBold from "./assets/fonts/Citerne-Bold.woff2";

// ─── Universal type styles ──────────────────────────────

export const typeHeadingLg = css`
  font-weight: 400;
  font-size: clamp(1rem, 5.5vw, 3.75rem);
  line-height: 1.1;
`;

export const typeHeadingLgLight = css`
  font-weight: 400;
  font-size: clamp(1.5rem, 5.5vw, 3.75rem);
  line-height: 1.1;
`;

export const typeBody = css`
  font-weight: 400;
  font-size: clamp(1.15rem, 2.35vw, 1.45rem);
  line-height: 1.2;
`;

/** Past carousel cursor + Project List chevrons (Unicode ← → ↓) */
export const typeArrow = css`
  ${typeBody}
  font-size: clamp(1rem, 5.5vw, 5rem);
`;

export const typeCaptionBold = css`
  font-weight: 500;
  font-size: clamp(0.875rem, 2.35vw, 1.15rem);
  line-height: 1.2;
`;

export const typeCaption = css`
  font-weight: 400;
  font-size: clamp(0.875rem, 2.35vw, 1.15rem);
  line-height: 1.2;
`;

export const typeSmall = css`
  font-weight: 400;
  font-size: clamp(0.75rem, 1.6vw, 0.8rem);
  text-transform: uppercase;
`;

/**
 * Per-row vertical margin on Project List `ListRow` (top + bottom). Grid items do not
 * collapse margins with neighbors, so the visible step between rows is `TYPE_SMALL_LIST_INTERLINE_GAP`.
 */
export const TYPE_SMALL_LIST_ROW_MARGIN = "0.2rem";

/** Matches the visual gap between Project List rows (`2 * TYPE_SMALL_LIST_ROW_MARGIN`). Use for block-stacked `typeSmall` lists where margins would otherwise collapse. */
export const TYPE_SMALL_LIST_INTERLINE_GAP = `calc(2 * ${TYPE_SMALL_LIST_ROW_MARGIN})`;

/**
 * Dense uppercase list typography — Project List row cells + preview captions,
 * Our Practice (Collaborators / Donations columns, Services secondary column).
 */
export const typeSmallList = css`
  ${typeSmall}
  line-height: 1.2;
`;

/** Grid list row (`ListRow`): margins do not collapse between rows. */
export const typeSmallListGridRowMargin = css`
  margin: ${TYPE_SMALL_LIST_ROW_MARGIN} 0;
`;

/** One stacked `p` or `li` line inside a `typeSmallList` block (non-collapsing bottom gap). */
export const typeSmallListStackedLeaf = css`
  margin: 0 0 ${TYPE_SMALL_LIST_INTERLINE_GAP} 0;
  padding: 0;
  break-inside: avoid;
`;

/**
 * Default HTML inside a `typeSmallList` root: `p` / `ul` / `ol` / `li` rhythm matches Project List.
 */
export const typeSmallListStackedItems = css`
  p {
    ${typeSmallListStackedLeaf}
  }

  p:last-child {
    margin-bottom: 0;
  }

  ul,
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    ${typeSmallListStackedLeaf}
    padding-left: 0;
  }

  li:last-child {
    margin-bottom: 0;
  }
`;

/** UI / caption line in sentence case, not uppercase (nav, Past meta, grid image captions, etc.). */
export const typeSmallMixed = css`
  font-weight: 400 !important;
  font-size: 1.25rem;
  line-height: 1.2;
  text-transform: none;
`;

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: 'Citerne';
    src: url(${citerneRegular}) format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Citerne';
    src: url(${citerneMedium}) format('woff2');
    font-weight: 500;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Citerne';
    src: url(${citerneBold}) format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }

  :root {
    --color-accent-green: rgb(0, 255, 0);
    --color-muted: rgba(0, 0, 0, 0.35);
    /** Light list / preview secondary text (was rgb(0 0 0 / 0.22)) */
    --color-muted-light: rgb(0 0 0 / 0.22);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    overflow-x: hidden;
  }

  body {
    font-family: 'Citerne', system-ui, -apple-system, sans-serif;
    padding-top: calc(3.5rem + 24px);
  }

  strong, b {
    font-weight: 500;
  }

  img{
    width: 100%;
  }
`;

export default GlobalStyle;
