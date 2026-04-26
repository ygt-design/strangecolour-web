import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import styled, { css } from "styled-components";
import gsap from "gsap";
import {
  getChannelContentsByTitle,
  fetchAllChannelContents,
  useArenaRefresh,
} from "../../arena";
import { Grid, GridCell, GRID } from "../../grid";
import { typeSmallList, typeSmallListGridRowMargin } from "../../styles";
import LoadingOverlay from "../../components/LoadingOverlay";

// ─── Helpers ─────────────────────────────────────────────

function findByTitle(items, title) {
  const t = title.toLowerCase();
  return items.find((item) => item.title?.toLowerCase() === t) ?? null;
}

function parseProjectName(channelTitle) {
  if (channelTitle.startsWith("→")) {
    const after = channelTitle.slice(1).trim();
    return after || channelTitle.trim();
  }
  return channelTitle.trim();
}

function getPlainText(block) {
  if (!block) return "";
  if (block.content?.plain) return block.content.plain.trim();
  if (block.content?.html)
    return block.content.html.replace(/<[^>]*>/g, "").trim();
  return "";
}

function getImageUrl(block) {
  if (!block) return null;
  const img = block.image;
  return img?.src ?? img?.display?.url ?? img?.original?.url ?? img?.large?.src ?? null;
}

/** Remove trailing unit tokens so we can parse the numeric part. */
function stripSizeSuffix(raw) {
  return (raw ?? "")
    .replace(/\s*sqm\.?$/i, "")
    .replace(/\s*m\s*²\s*$/i, "")
    .replace(/\s*m2\s*$/i, "")
    .replace(/\s*s\.?f\.?\s*$/i, "")
    .replace(/\s*sq\.?\s*ft\.?\s*$/i, "")
    .replace(/\s*sf\s*$/i, "")
    .trim();
}

/** Leading numeric value (commas / inner spaces allowed). */
function parseSizeNumber(raw) {
  const stripped = stripSizeSuffix((raw ?? "").trim());
  if (!stripped) return NaN;
  const match = stripped.match(/^[\d,.\s]+/);
  if (!match) return NaN;
  const n = parseFloat(match[0].replace(/,/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

const SQ_M_TO_SQ_FT = 10.76391041671;

/**
 * Square feet for display + sort. If the string clearly indicates m² / sqm, convert; otherwise treat the number as s.f.
 */
function sizeToSqFt(raw) {
  const rawStr = (raw ?? "").trim();
  const n = parseSizeNumber(rawStr);
  if (!Number.isFinite(n)) return null;
  const isMetric = /\bsqm\b|sq\.?\s*m\.?|m\s*²|\bm2\b/i.test(rawStr);
  if (isMetric) return n * SQ_M_TO_SQ_FT;
  return n;
}

/**
 * List + preview size label.
 * - Numeric values are normalized to s.f.
 * - Non-numeric labels (e.g. LRG / M / SML) are shown as authored.
 */
function formatSizeSf(raw) {
  const rawStr = (raw ?? "").trim();
  if (!rawStr) return "";
  const sqft = sizeToSqFt(raw);
  if (sqft == null) return rawStr;
  const rounded = Math.round(sqft);
  return `${rounded.toLocaleString("en-US")}\u00A0s.f.`;
}

function sortProjects(projects, sortBy, sortDir) {
  const sorted = [...projects];
  const compareWithDir = (cmp) => (sortDir === "desc" ? -cmp : cmp);
  switch (sortBy) {
    case "project":
      return sorted.sort((a, b) => compareWithDir(a.name.localeCompare(b.name)));
    case "client":
      return sorted.sort((a, b) => compareWithDir((a.client || "").localeCompare(b.client || "")));
    case "size":
      return sorted.sort((a, b) => {
        const av = sizeToSqFt(a.size);
        const bv = sizeToSqFt(b.size);
        const aOk = av != null;
        const bOk = bv != null;
        if (aOk && bOk) return compareWithDir(av - bv);
        if (!aOk && !bOk) {
          return compareWithDir((a.size || "").localeCompare(b.size || ""));
        }
        return aOk ? -1 : 1;
      });
    default:
      return sorted;
  }
}

// ─── Styled components ───────────────────────────────────

const Page = styled.main``;

const LayoutGrid = styled(Grid)`
  row-gap: 0;
  align-items: start;
`;

const LIST_ROW_STACK_GAP = "0.3rem";
const PREVIEW_IMAGE_CAPTION_GAP = "0.3rem";

// Left preview panel 

const PreviewCell = styled(GridCell)`
  position: relative;
  align-self: stretch;
  /* overflow: hidden; */

  @media ${GRID.MEDIA_MOBILE} {
    display: none;
  }
`;

const PreviewPanel = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: ${LIST_ROW_STACK_GAP};
`;

const PreviewImage = styled.div`
  width: 100%;
  max-height: 60vh;
  overflow: hidden;
  flex-shrink: 0;
  line-height: 0;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.2s ease;

  img {
    display: block;
    width: 100%;
    height: auto;
  }
`;

const PreviewTopRow = styled.div`
  ${typeSmallList}
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: ${LIST_ROW_STACK_GAP};
  align-items: baseline;
  min-width: 0;
  color: black;
  margin-bottom: ${PREVIEW_IMAGE_CAPTION_GAP};
`;

const PreviewYear = styled.span`
  min-width: 0;
`;

const PreviewArchitect = styled.span`
  text-align: right;
  justify-self: end;
  min-width: 0;
`;

const PreviewCaptionScope = styled.div`
  ${typeSmallList}
  max-width: 50%;
  margin-top: ${PREVIEW_IMAGE_CAPTION_GAP};
  min-width: 0;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
`;

// ─── Right list (subgrid: columns snap to site grid tracks) ─

/** List band is 8 cols desktop / 5 tablet / 4 mobile — integer spans sum to that width. */
const listColProject = css`
  grid-column: 1 / span 3;
  @media ${GRID.MEDIA_TABLET} {
    grid-column: 1 / span 2;
  }
  @media ${GRID.MEDIA_MOBILE} {
    grid-column: 1 / span 2;
  }
`;

const listColClient = css`
  grid-column: 4 / span 3;
  @media ${GRID.MEDIA_TABLET} {
    grid-column: 3 / span 2;
  }
  @media ${GRID.MEDIA_MOBILE} {
    grid-column: 3 / span 1;
  }
`;

const listColSize = css`
  grid-column: 7 / span 2;
  @media ${GRID.MEDIA_TABLET} {
    grid-column: 5 / span 1;
  }
  @media ${GRID.MEDIA_MOBILE} {
    grid-column: 4 / span 1;
  }
`;

const ListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  column-gap: ${GRID.GAP}px;
  width: 100%;
  min-width: 0;

  @media ${GRID.MEDIA_TABLET} {
    grid-template-columns: repeat(5, 1fr);
    column-gap: ${GRID.GAP_TABLET};
  }

  @media ${GRID.MEDIA_MOBILE} {
    grid-template-columns: repeat(4, 1fr);
    column-gap: ${GRID.GAP_MOBILE};
  }
`;

const SortArrow = styled.svg.attrs({
  viewBox: "0 0 233.2 244.42",
  "aria-hidden": true,
  focusable: "false",
})`
  display: inline-block;
  height: 1rem;
  width: 1.25rem;
  fill: currentColor;
  transform: ${(p) => (p.$dir === "asc" ? "rotate(-90deg)" : "rotate(90deg)")};
  opacity: 0;
  transition: transform 0.12s ease, opacity 0.12s ease;
`;

const HeaderButton = styled.button`
  ${typeSmallList}
  font-weight: 400;
  background: none;
  border: none;
  padding: 0;
  padding-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  justify-content: flex-start;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(0, 0, 0);
  transition: color 0.12s;
  cursor: pointer;

  &:hover {
    color: rgb(0, 0, 0);
  }

  &:hover ${SortArrow},
  &:focus-visible ${SortArrow} {
    opacity: 1;
  }
`;

const Cell = styled.div`
  ${typeSmallList}
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

const SizeCell = styled(Cell)`
  text-align: right;
`;

/** Counteract `typeSmallList` uppercase so "s.f." stays mixed case. */
const NoUppercase = styled.span`
  text-transform: none;
`;

const SizeHeaderButton = styled(HeaderButton)`
  justify-content: flex-end;
  text-align: right;
`;

const HeaderProject = styled(HeaderButton)`
  ${listColProject}
`;

const HeaderClient = styled(HeaderButton)`
  ${listColClient}
`;

const HeaderSize = styled(SizeHeaderButton)`
  ${listColSize}
`;

const ListCellProject = styled(Cell)`
  ${listColProject}
`;

const ListCellClient = styled(Cell)`
  ${listColClient}
`;

const ListCellSize = styled(SizeCell)`
  ${listColSize}
`;

const ListRow = styled.div`
  ${typeSmallListGridRowMargin}
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;
  color: ${(p) => (p.$dimmed ? "var(--color-muted-light)" : "inherit")};

  ${ListCellProject},
  ${ListCellClient},
  ${ListCellSize} {
    color: inherit;
  }
`;

function PreviewCaptions({ project }) {
  if (!project) return null;
  const { scope } = project;
  if (!scope) return null;
  return <PreviewCaptionScope>{scope}</PreviewCaptionScope>;
}

// ─── Component ───────────────────────────────────────────

function ProjectList() {
  const [projects, setProjects] = useState(null);
  const [sortBy, setSortBy] = useState("project");
  const [sortDir, setSortDir] = useState("asc");
  const [hoveredProject, setHoveredProject] = useState(null);
  const [previewProject, setPreviewProject] = useState(null);
  const [previewTop, setPreviewTop] = useState(0);

  const rowsRef = useRef([]);
  const hasAnimated = useRef(false);
  const previewCellRef = useRef(null);
  const previewPanelRef = useRef(null);
  const hoveredRowRef = useRef(null);

  const sorted = useMemo(
    () => (projects ? sortProjects(projects, sortBy, sortDir) : null),
    [projects, sortBy, sortDir],
  );

  const handleSortClick = useCallback((key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDir("asc");
  }, [sortBy]);

  const updatePreviewPosition = useCallback(() => {
    const cellEl = previewCellRef.current;
    const panelEl = previewPanelRef.current;
    const rowEl = hoveredRowRef.current;
    if (!cellEl || !panelEl || !rowEl) return;

    const cellRect = cellEl.getBoundingClientRect();
    /**
     * `ListRow` uses margin (not padding), so its border box matches the cell grid.
     * Measuring the row avoids sub-pixel drift vs. measuring a single cell.
     */
    const rowRect = rowEl.getBoundingClientRect();
    const panelHeight = panelEl.offsetHeight;
    const vh = window.innerHeight;

    const alignTop = rowRect.top - cellRect.top;

    const needsViewportFlip = rowRect.top + panelHeight > vh;
    if (needsViewportFlip) {
      const bottomAlignTop = (rowRect.bottom - cellRect.top) - panelHeight;
      setPreviewTop(Math.max(0, bottomAlignTop));
    } else {
      setPreviewTop(alignTop);
    }
  }, []);

  const handleRowEnter = useCallback((project, e) => {
    setHoveredProject(project);
    setPreviewProject(project);
    hoveredRowRef.current = e.currentTarget;
    requestAnimationFrame(updatePreviewPosition);
  }, [updatePreviewPosition]);

  const handleRowLeave = useCallback(() => {
    setHoveredProject(null);
    hoveredRowRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!hoveredProject) return;
    const id = requestAnimationFrame(() => {
      updatePreviewPosition();
    });
    return () => cancelAnimationFrame(id);
  }, [hoveredProject, updatePreviewPosition]);

  const refreshKey = useArenaRefresh();

  useEffect(() => {
    let cancelled = false;
    const skipCache = refreshKey > 0;

    async function load() {
      const contents = await getChannelContentsByTitle("Page / Project List", undefined, { skipCache });

      const projectChannels = contents.filter(
        (item) =>
          item.type === "Channel" &&
          typeof item.title === "string" &&
          item.title.startsWith("→"),
      );

      const loaded = await Promise.all(
        projectChannels.map(async (channel) => {
          const slug = channel.slug ?? String(channel.id);
          const channelContents = await fetchAllChannelContents(slug, { skipCache });

          if (import.meta.env.DEV) {
            console.log("[ProjectList] channel:", channel.title, {
              slug,
              totalBlocks: channelContents.length,
              titles: channelContents.map((b) => b.title),
            });
          }

          const name = parseProjectName(channel.title);
          const client = getPlainText(findByTitle(channelContents, "Client"));
          const scope = getPlainText(findByTitle(channelContents, "Scope"));
          const architect = getPlainText(findByTitle(channelContents, "Architect"));
          const year = getPlainText(findByTitle(channelContents, "Year"));
          const size = getPlainText(findByTitle(channelContents, "Size"));

          const imageBlock = findByTitle(channelContents, "Thumbnail")
            ?? findByTitle(channelContents, "Image")
            ?? channelContents.find((b) => b.image);
          const imageUrl = getImageUrl(imageBlock);

          return { id: channel.id, name, client, scope, architect, year, size, imageUrl };
        }),
      );

      if (!cancelled) {
        loaded.forEach((p) => { if (p.imageUrl) new Image().src = p.imageUrl; });
        setProjects(loaded);
      }
    }

    load().catch((err) => console.error("ProjectList: fetch failed", err));
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    if (!sorted || hasAnimated.current) return;
    hasAnimated.current = true;

    const rows = rowsRef.current.filter(Boolean);
    if (rows.length) {
      gsap.fromTo(
        rows,
        { opacity: 0, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.025,
          ease: "cubic-bezier(0.1,0.7,0.5,1)",
        },
      );
    }
  }, [sorted]);

  const previewVisible = !!hoveredProject;

  return (
    <>
    <LoadingOverlay isLoaded={!!sorted} />
    {sorted && <Page>
      <LayoutGrid as="div">
        {/* Left: sticky preview panel (cols 1–3) */}
        <PreviewCell ref={previewCellRef} $start={1} $span={4} $startTablet={1} $spanTablet={3}>
          <PreviewPanel
            ref={previewPanelRef}
            style={{ top: `${previewTop}px` }}
          >
            {previewVisible && (
              <>
                {(previewProject?.year || previewProject?.architect) && (
                  <PreviewTopRow>
                    <PreviewYear>{previewProject?.year ?? ""}</PreviewYear>
                    <PreviewArchitect>{previewProject?.architect ?? ""}</PreviewArchitect>
                  </PreviewTopRow>
                )}
                <PreviewImage $visible={!!previewProject?.imageUrl}>
                  {previewProject?.imageUrl && (
                    <img
                      src={previewProject.imageUrl}
                      alt={previewProject.name}
                      onLoad={updatePreviewPosition}
                    />
                  )}
                </PreviewImage>
                <PreviewCaptions project={previewProject} />
              </>
            )}
          </PreviewPanel>
        </PreviewCell>

        {/* Right: project list (cols 4–12) */}
        <GridCell
          $start={5}
          $span={8}
          $startTablet={4}
          $spanTablet={5}
          $startMobile={1}
          $spanMobile={4}
        >
          <ListContainer>
            <HeaderProject
              type="button"
              $active={sortBy === "project"}
              onClick={() => handleSortClick("project")}
            >
              Project
              <SortArrow $dir={sortBy === "project" ? sortDir : "asc"}>
                <polygon points="210.79 116.8 109.85 15.85 98.98 26.72 180.88 108.62 178.31 108.39 20.87 108.39 20.87 125.21 178.31 125.21 180.88 124.99 98.98 206.89 109.85 217.75 210.79 116.8 210.79 116.8" />
              </SortArrow>
            </HeaderProject>
            <HeaderClient
              type="button"
              $active={sortBy === "client"}
              onClick={() => handleSortClick("client")}
            >
              Client
              <SortArrow $dir={sortBy === "client" ? sortDir : "asc"}>
                <polygon points="210.79 116.8 109.85 15.85 98.98 26.72 180.88 108.62 178.31 108.39 20.87 108.39 20.87 125.21 178.31 125.21 180.88 124.99 98.98 206.89 109.85 217.75 210.79 116.8 210.79 116.8" />
              </SortArrow>
            </HeaderClient>
            <HeaderSize
              type="button"
              $active={sortBy === "size"}
              onClick={() => handleSortClick("size")}
            >
              <SortArrow $dir={sortBy === "size" ? sortDir : "asc"}>
                <polygon points="210.79 116.8 109.85 15.85 98.98 26.72 180.88 108.62 178.31 108.39 20.87 108.39 20.87 125.21 178.31 125.21 180.88 124.99 98.98 206.89 109.85 217.75 210.79 116.8 210.79 116.8" />
              </SortArrow>
              Size
            </HeaderSize>

            {sorted.map((project, i) => (
              <ListRow
                key={project.id}
                ref={(el) => { rowsRef.current[i] = el; }}
                style={{ opacity: 0 }}
                $dimmed={hoveredProject != null && hoveredProject.id !== project.id}
                onMouseEnter={(e) => handleRowEnter(project, e)}
                onMouseLeave={handleRowLeave}
              >
                <ListCellProject>{project.name}</ListCellProject>
                <ListCellClient>{project.client}</ListCellClient>
                <ListCellSize>
                  <NoUppercase>{formatSizeSf(project.size)}</NoUppercase>
                </ListCellSize>
              </ListRow>
            ))}
          </ListContainer>
        </GridCell>
      </LayoutGrid>
    </Page>}
    </>
  );
}

export default ProjectList;
