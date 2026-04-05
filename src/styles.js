import { css, createGlobalStyle } from "styled-components";
import citerneLight from "./assets/fonts/Citerne-Light.woff2";
import citerneRegular from "./assets/fonts/Citerne-Regular.woff2";
import citerneMedium from "./assets/fonts/Citerne-Medium.woff2";
import citerneBold from "./assets/fonts/Citerne-Bold.woff2";

// ─── Universal type styles ──────────────────────────────

export const typeHeadingLg = css`
  font-weight: 300;
  font-size: clamp(1rem, 4.5vw, 3.5rem);
  line-height: 1.1;
`;

export const typeHeadingLgLight = css`
  font-weight: 300;
  font-size: clamp(1.5rem, 4.5vw, 3.5rem);
  line-height: 1.1;
`;

export const typeBody = css`
  font-weight: 300;
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
  font-weight: 300;
  font-size: clamp(0.875rem, 2.35vw, 1.15rem);
  line-height: 1.2;
`;

export const typeSmall = css`
  font-weight: 400;
  font-size: clamp(0.75rem, 1.6vw, 0.8rem);
  text-transform: uppercase;
`;

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: 'Citerne';
    src: url(${citerneLight}) format('woff2');
    font-weight: 300;
    font-style: normal;
    font-display: swap;
  }

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
    padding-top: calc(3rem + 24px);
  }

  strong, b {
    font-weight: 500;
  }

  img{
    width: 100%;
  }
`;

export default GlobalStyle;
