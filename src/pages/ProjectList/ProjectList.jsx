import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import styled, { css } from "styled-components";
import gsap from "gsap";
import {
  getChannelContentsByTitle,
  fetchAllChannelContents,
  useArenaRefresh,
} from "../../arena";
import { Grid, GridCell, GRID } from "../../grid";
import { typeSmall } from "../../styles";
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

function stripTrailingSqm(raw) {
  return raw.replace(/\s*sqm\.?$/i, "").trim();
}

/** Display size with square-metre notation (values from Are.na stay numeric / plain). */
function formatSizeSqm(raw) {
  const s = stripTrailingSqm((raw ?? "").trim());
  if (!s) return "";
  return `${s}\u00A0m\u00B2`;
}

function sortProjects(projects, sortBy) {
  const sorted = [...projects];
  switch (sortBy) {
    case "project":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "client":
      return sorted.sort((a, b) => (a.client || "").localeCompare(b.client || ""));
    case "size":
      return sorted.sort((a, b) =>
        stripTrailingSqm(a.size || "").localeCompare(stripTrailingSqm(b.size || "")),
      );
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

const cellType = typeSmall;

// ─── Left preview panel ──────────────────────────────────

const PreviewCell = styled(GridCell)`
  position: relative;
  align-self: stretch;
  overflow: hidden;

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
  gap: 0.75rem;
`;

const PreviewImage = styled.div`
  width: 100%;
  overflow: hidden;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.2s ease;

  img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 50vh;
    object-fit: contain;
    object-position: top left;
  }
`;

const PreviewMetaTop = styled.div`
  ${cellType}
  min-width: 0;
`;

const PreviewScope = styled.div`
  ${cellType}
  color: black;
  min-width: 0;
`;

const PreviewMetaRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: baseline;
  min-width: 0;
  color: black;
`;

const PreviewArchitect = styled.span`
  text-align: right;
  justify-self: end;
  min-width: 0;
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

const HeaderButton = styled.button`
  ${cellType}
  background: none;
  border: none;
  padding: 0;
  padding-bottom: 1.5rem;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${(p) => (p.$active ? "var(--color-accent-green)" : "var(--color-muted-light)")};
  transition: color 0.12s;
  cursor: pointer;

  &:hover {
    color: var(--color-accent-green);
  }
`;

const Cell = styled.div`
  ${cellType}
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

const SizeCell = styled(Cell)`
  text-align: right;
`;

/** Counteract ${cellType} uppercase so m² (and any CMS text) stays mixed / lowercase. */
const NoUppercase = styled.span`
  text-transform: none;
`;

const SizeHeaderButton = styled(HeaderButton)`
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
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  cursor: pointer;
  padding: 0.1rem 0;
  transition: color 0.15s ease;
  color: ${(p) => (p.$dimmed ? "var(--color-muted-light)" : "inherit")};

  ${ListCellProject},
  ${ListCellClient},
  ${ListCellSize} {
    color: inherit;
  }
`;

// ─── Component ───────────────────────────────────────────

function ProjectList() {
  const [projects, setProjects] = useState(null);
  const [sortBy, setSortBy] = useState("project");
  const [hoveredProject, setHoveredProject] = useState(null);
  const [previewProject, setPreviewProject] = useState(null);
  const [previewTop, setPreviewTop] = useState(0);

  const rowsRef = useRef([]);
  const hasAnimated = useRef(false);
  const previewCellRef = useRef(null);
  const previewPanelRef = useRef(null);
  const hoveredRowRef = useRef(null);

  const sorted = useMemo(
    () => (projects ? sortProjects(projects, sortBy) : null),
    [projects, sortBy],
  );

  const updatePreviewPosition = useCallback(() => {
    const cellEl = previewCellRef.current;
    const panelEl = previewPanelRef.current;
    const rowEl = hoveredRowRef.current;
    if (!cellEl || !panelEl || !rowEl) return;

    const cellRect = cellEl.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const panelHeight = panelEl.offsetHeight;
    const vh = window.innerHeight;

    const alignTop = rowRect.top - cellRect.top;

    if (rowRect.top + panelHeight > vh) {
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

          const imageBlock = findByTitle(channelContents, "Image")
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
            {previewVisible &&
              (previewProject?.year || previewProject?.architect) && (
                <PreviewMetaTop>
                  <PreviewMetaRow>
                    <span>{previewProject?.year ?? ""}</span>
                    <PreviewArchitect>
                      {previewProject?.architect ?? ""}
                    </PreviewArchitect>
                  </PreviewMetaRow>
                </PreviewMetaTop>
              )}
            <PreviewImage $visible={previewVisible && !!previewProject?.imageUrl}>
              {previewProject?.imageUrl && (
                <img
                  src={previewProject.imageUrl}
                  alt={previewProject.name}
                  onLoad={updatePreviewPosition}
                />
              )}
            </PreviewImage>
            {previewVisible && previewProject?.scope && (
              <PreviewScope>{previewProject.scope}</PreviewScope>
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
              onClick={() => setSortBy("project")}
            >
              Project
            </HeaderProject>
            <HeaderClient
              type="button"
              $active={sortBy === "client"}
              onClick={() => setSortBy("client")}
            >
              Client
            </HeaderClient>
            <HeaderSize
              type="button"
              $active={sortBy === "size"}
              onClick={() => setSortBy("size")}
            >
              Size
              <NoUppercase>{"\u00A0m\u00B2"}</NoUppercase>
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
                  <NoUppercase>{formatSizeSqm(project.size)}</NoUppercase>
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
