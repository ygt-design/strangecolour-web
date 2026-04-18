import { useState, useEffect, useLayoutEffect, useRef } from "react";
import styled from "styled-components";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  getChannelContentsByTitle,
  fetchAllChannelContents,
  useArenaRefresh,
} from "../../arena";
import { Grid, GridCell, GRID } from "../../grid";
import ThumbnailItem from "../../components/ThumbnailItem";
import LoadingOverlay from "../../components/LoadingOverlay";
import { typeHeadingLg } from "../../styles";
import {
  parseLayoutConfig,
  rowToBlocks,
  scaleRow,
} from "./layoutConfig";

gsap.registerPlugin(ScrollTrigger);

const LargeText = styled.div`
  ${typeHeadingLg}
  max-width: 100%;
  margin-top: 2rem;

  p {
    margin: 0 0 0.5em;
  }

  p:last-child {
    margin-bottom: 0;
  }
`;

/** Intro header: categories cycle these on hover (`data-category-hover` in document order). */
const CATEGORY_HOVER = ["#0f756f", "#75570f", "#750f61"];

const introCategoryHoverBlock = [0, 1, 2]
  .map(
    (i) => `
  & a[data-category-hover="${i}"]:hover,
  & a[data-category-hover="${i}"]:focus-visible,
  & a[data-category-hover="${i}"]:active,
  & strong[data-category-hover="${i}"]:hover,
  & strong[data-category-hover="${i}"]:focus-visible,
  & strong[data-category-hover="${i}"]:active,
  & b[data-category-hover="${i}"]:hover,
  & b[data-category-hover="${i}"]:focus-visible,
  & b[data-category-hover="${i}"]:active {
    color: ${CATEGORY_HOVER[i]} !important;
  }`,
  )
  .join("");

const IntroText = styled(LargeText)`
  margin-top: ${(p) => (p.$afterDate ? "1rem" : "2rem")};

  @media ${GRID.MEDIA_MOBILE} {
    margin-top: ${(p) => (p.$afterDate ? "0.35rem" : "2rem")};
  }

  & a {
    color: inherit;
    text-decoration: none;
    transition: color 0.45s ease;
  }

  & strong,
  & b {
    transition: color 0.45s ease;
  }

  ${introCategoryHoverBlock}

  @media (prefers-reduced-motion: reduce) {
    & a,
    & strong,
    & b {
      transition: none;
    }
  }
`;

/** Smaller than `LargeText` / title so the date reads as secondary (lower cap height / optical scale). */
const DateBlock = styled.div`
  max-width: 100%;
  margin-top: 0;
  font-weight: 400;
  font-size: clamp(0.9375rem, 2.85vw, 2.15rem);
  line-height: 1.2;

  p {
    margin: 0 0 0.5em;
  }

  p:last-child {
    margin-bottom: 0;
  }
`;

const IntroWrap = styled.div`
  grid-column: 1 / -1;
  margin-bottom: 35vh;

  @media ${GRID.MEDIA_MOBILE} {
    margin-bottom: 4rem;
  }
`;

function getImageUrl(block) {
  if (!block) return null;
  const img = block.image;
  if (img) {
    return img.src ?? img.display?.url ?? img.original?.url ?? img.thumb?.url ?? null;
  }
  return null;
}

function findByTitle(items, title) {
  const t = title.toLowerCase();
  return items.find(
    (item) => item.title?.toLowerCase() === t
  ) ?? null;
}

const DEFAULT_ROW_PATTERN = [1, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2];
const DEFAULT_SHIFT_PATTERN = [0, 1, -1, 0, 1, 0, -1, 1, 0];

function parsePattern(str) {
  const arr = str.split(",").map((s) => parseInt(s.trim(), 10));
  return arr.every((n) => !Number.isNaN(n)) && arr.length > 0 ? arr : null;
}

function buildRows(thumbnails, rowPattern = DEFAULT_ROW_PATTERN) {
  const rows = [];
  let i = 0;
  let rowIndex = 0;

  while (i < thumbnails.length) {
    const remaining = thumbnails.length - i;
    const want = rowPattern[rowIndex % rowPattern.length];
    const count = Math.min(want, remaining);
    rows.push(thumbnails.slice(i, i + count));
    i += count;
    rowIndex++;
  }

  return rows;
}

/**
 * Calculate column span from aspect ratio using sqrt(ar) scaling
 * (equal visual area approach). Used only in legacy (non-JSON) mode.
 */
function itemSpan(thumbnail, maxSpan) {
  const ar = thumbnail?.image?.aspect_ratio ?? 1;
  return Math.max(3, Math.min(Math.round(Math.sqrt(ar) * 4.5), maxSpan));
}

/**
 * Legacy placement: spans derived from image aspect ratio.
 */
function distributeColumns(row, totalCols, rowIndex, shiftPattern = DEFAULT_SHIFT_PATTERN) {
  const half = totalCols / 2;
  const shift = shiftPattern[rowIndex % shiftPattern.length];

  if (row.length === 1) {
    const span = itemSpan(row[0].thumbnail, half);
    let start = Math.floor((totalCols - span) / 2) + 1 + shift;
    start = Math.max(1, Math.min(start, totalCols - span + 1));
    return [{ start, span }];
  }

  const leftSpan = itemSpan(row[0].thumbnail, half);
  const rightSpan = itemSpan(row[1].thumbnail, half);

  let leftStart = half + shift - leftSpan + 1;
  let rightStart = half + shift + 1;

  if (leftStart < 1) { leftStart = 1; rightStart = leftStart + leftSpan; }
  if (rightStart + rightSpan - 1 > totalCols) { rightStart = totalCols - rightSpan + 1; leftStart = rightStart - leftSpan; }

  return [
    { start: leftStart, span: leftSpan },
    { start: rightStart, span: rightSpan },
  ];
}

function distributeColumnsFromConfig(template, totalCols) {
  if (totalCols === 12) return rowToBlocks(template, 12);
  const scaled = scaleRow(template, totalCols, 12);
  return rowToBlocks(scaled, totalCols);
}

const EASE = "cubic-bezier(0.1,0.7,0.5,1)";

/**
 * Walk an element's text nodes, wrap every word in a <span>,
 * and return the array of word spans for animation.
 */
function wrapWords(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  const spans = [];
  textNodes.forEach((node) => {
    const parts = node.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else if (part) {
        const span = document.createElement("span");
        span.style.display = "inline-block";
        span.style.opacity = "0";
        span.textContent = part;
        frag.appendChild(span);
        spans.push(span);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });
  return spans;
}

/**
 * Mark category targets for hover colors. Prefer `<a>` when present (Arena often uses bold only).
 */
function tagIntroCategoryTargets(introRoot) {
  if (!introRoot) return;
  const links = introRoot.querySelectorAll("a");
  const nodes =
    links.length > 0
      ? [...links]
      : [...introRoot.querySelectorAll("strong, b")];
  nodes.forEach((el, i) => {
    el.dataset.categoryHover = String(i % CATEGORY_HOVER.length);
  });
}

function Current() {
  const [data, setData] = useState(null);
  const textRefs = useRef([]);
  const thumbCellRefs = useRef([]);
  const introTextRef = useRef(null);
  const hasAnimated = useRef(false);
  const refreshKey = useArenaRefresh();

  useEffect(() => {
    let cancelled = false;
    const skipCache = refreshKey > 0;

    async function load() {
      const contents = await getChannelContentsByTitle("Page / Current", undefined, { skipCache });

      const dateBlock = findByTitle(contents, "Date");
      const introBlock = findByTitle(contents, "Intro");

      // Layout patterns (editable via CMS)
      const layoutConfigBlock = findByTitle(contents, "Current Grid Layout");
      const rowPatternBlock = findByTitle(contents, "Row Pattern");
      const shiftPatternBlock = findByTitle(contents, "Shift Pattern");
      const getBlockText = (b) =>
        (b?.content?.plain ?? b?.content ?? "").toString().trim();

      let layoutRows = null;
      if (layoutConfigBlock) {
        const config = parseLayoutConfig(getBlockText(layoutConfigBlock));
        if (config) layoutRows = config.rows;
      }

      const rowPattern = rowPatternBlock
        ? parsePattern(getBlockText(rowPatternBlock)) ?? DEFAULT_ROW_PATTERN
        : DEFAULT_ROW_PATTERN;
      const shiftPattern = shiftPatternBlock
        ? parsePattern(getBlockText(shiftPatternBlock)) ?? DEFAULT_SHIFT_PATTERN
        : DEFAULT_SHIFT_PATTERN;

      // `Page / Current` is the source of truth. Disconnecting a `//` channel in the CMS
      // removes it here; the Are.na group isn't used as a fallback since group membership
      // persists after disconnection and would resurrect removed items.
      const slashChannels = contents.filter(
        (item) =>
          item.type === "Channel" &&
          typeof item.title === "string" &&
          item.title.startsWith("//")
      );

      // Fetch each // channel's contents in parallel (single request per channel)
      const thumbnails = await Promise.all(
        slashChannels.map(async (channel) => {
          const slug = channel.slug ?? String(channel.id);
          const channelContents = await fetchAllChannelContents(slug, { skipCache });
          const thumbnail = findByTitle(channelContents, "Thumbnail");
          const subtitle = findByTitle(channelContents, "Subtitle");

          // Collect all image URLs: Thumbnail first, then other image blocks
          const thumbnailUrl = getImageUrl(thumbnail);
          const otherImageUrls = channelContents
            .filter(
              (block) =>
                block !== thumbnail &&
                block.type !== "Channel" &&
                block.title?.toLowerCase() !== "subtitle" &&
                getImageUrl(block)
            )
            .map(getImageUrl);
          const images = [thumbnailUrl, ...otherImageUrls].filter(Boolean);

          if (import.meta.env.DEV) {
            console.log("[Current] //channel:", channel.title, {
              slug,
              totalBlocks: channelContents.length,
              thumbnail: thumbnail
                ? { type: thumbnail.type, hasImage: !!thumbnail.image, keys: Object.keys(thumbnail) }
                : null,
              imageUrl: thumbnailUrl,
              totalImages: images.length,
            });
          }

          return { channel, thumbnail, subtitle, images };
        })
      );

      const excludeIds = new Set(
        [dateBlock?.id, introBlock?.id, layoutConfigBlock?.id, rowPatternBlock?.id, shiftPatternBlock?.id].filter(Boolean)
      );
      const restTextBlocks = contents.filter(
        (item) =>
          item.type === "Text" &&
          !excludeIds.has(item.id)
      );

      if (!cancelled) {
        // Preload all thumbnail images so they're cached before scroll
        thumbnails.forEach(({ images }) => {
          images.forEach((url) => { new Image().src = url; });
        });
        setData({ dateBlock, introBlock, restTextBlocks, thumbnails, rowPattern, shiftPattern, layoutRows });
      }
    }

    load().catch((err) => console.error("Current: fetch failed", err));
    return () => { cancelled = true; };
  }, [refreshKey]);

  // After Intro HTML is in the DOM — re-apply whenever CMS content changes (not gated by word animation).
  useLayoutEffect(() => {
    if (!data?.introBlock) return;
    tagIntroCategoryTargets(introTextRef.current);
  }, [data?.introBlock]);

  // Word-by-word text entrance (runs on first render with data)
  useEffect(() => {
    if (!data || hasAnimated.current) return;
    hasAnimated.current = true;

    const texts = textRefs.current.filter(Boolean);
    const allWords = [];
    texts.forEach((el) => {
      el.style.opacity = "1";
      allWords.push(...wrapWords(el));
    });
    tagIntroCategoryTargets(introTextRef.current);
    if (allWords.length) {
      gsap.fromTo(
        allWords,
        { opacity: 0, y: "0.3em" },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.012, ease: EASE },
      );
    }
  }, [data]);

  // Fade-in on scroll for thumbnail cells
  useEffect(() => {
    if (!data) return;
    const cells = thumbCellRefs.current.filter(Boolean);
    if (!cells.length) return;

    gsap.set(cells, { opacity: 0 });

    const triggers = cells.map((cell) =>
      ScrollTrigger.create({
        trigger: cell,
        start: "top 90%",
        once: true,
        onEnter: () => {
          gsap.to(cell, { opacity: 1, duration: 0.8, ease: "power2.out" });
        },
      })
    );

    return () => triggers.forEach((t) => t.kill());
  }, [data]);

  const { dateBlock, introBlock, restTextBlocks, thumbnails, rowPattern, shiftPattern, layoutRows } = data ?? {};

  const textCells = data
    ? [dateBlock, introBlock, ...restTextBlocks]
        .filter(Boolean)
        .map((block, i) => {
          const isDate = block.id === dateBlock?.id;
          const isIntro = block.id === introBlock?.id;
          const body = isDate ? (
            <DateBlock dangerouslySetInnerHTML={{ __html: block.content?.html }} />
          ) : isIntro ? (
            <IntroText
              ref={introTextRef}
              $afterDate={!!dateBlock}
              dangerouslySetInnerHTML={{ __html: block.content?.html }}
            />
          ) : (
            <LargeText dangerouslySetInnerHTML={{ __html: block.content?.html }} />
          );
          const cell = (
            <GridCell
              key={block.id}
              ref={(el) => { textRefs.current[i] = el; }}
              style={{ opacity: 0 }}
              $start={1}
              $span={12}
              $spanMobile={4}
            >
              {body}
            </GridCell>
          );
          return block.id === introBlock?.id ? (
            <IntroWrap key={block.id}>{cell}</IntroWrap>
          ) : (
            cell
          );
        })
    : null;

  const useJsonLayout = !!layoutRows;
  const effectiveRowPattern = useJsonLayout
    ? layoutRows.map((r) => r.spans.length)
    : rowPattern;

  let thumbIdx = 0;
  const thumbnailCells = data
    ? buildRows(thumbnails, effectiveRowPattern).flatMap((row, rowIdx) => {
        let desktopLayouts, tabletLayouts, rowAlign;

        if (useJsonLayout) {
          const template = layoutRows[rowIdx % layoutRows.length];
          desktopLayouts = distributeColumnsFromConfig(template, 12);
          tabletLayouts = distributeColumnsFromConfig(template, 8);
          rowAlign = template.align;
        } else {
          desktopLayouts = distributeColumns(row, 12, rowIdx, shiftPattern);
          tabletLayouts = distributeColumns(row, 8, rowIdx, shiftPattern);
          rowAlign = undefined;
        }

        return row.map(({ channel, thumbnail, subtitle, images }, j) => {
          const refIdx = thumbIdx++;
          return (
            <GridCell
              key={channel.id}
              ref={(el) => { thumbCellRefs.current[refIdx] = el; }}
              $start={desktopLayouts[j].start}
              $span={desktopLayouts[j].span}
              $startTablet={tabletLayouts[j].start}
              $spanTablet={tabletLayouts[j].span}
              $spanMobile={4}
            >
              <ThumbnailItem
                title={channel.title}
                thumbnailUrl={getImageUrl(thumbnail)}
                images={images}
                subtitleHtml={subtitle?.content?.html ?? null}
                align={rowAlign}
              />
            </GridCell>
          );
        });
      })
    : null;

  return (
    <>
      <LoadingOverlay isLoaded={!!data} />
      {data && (
        <main>
          <Grid as="div">
            {textCells}
            {thumbnailCells}
          </Grid>
        </main>
      )}
    </>
  );
}

export default Current;
