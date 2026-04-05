import { useState, useEffect, useRef, useCallback } from "react";
import styled from "styled-components";
import {
  getChannelContentsByTitle,
  fetchAllChannelContents,
  useArenaRefresh,
} from "../../arena";
import { Grid, GridCell, GRID } from "../../grid";
import { typeBody, typeSmall, typeArrow } from "../../styles";
import LoadingOverlay from "../../components/LoadingOverlay";

// ─── Helpers ─────────────────────────────────────────────

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
  return items.find((item) => item.title?.toLowerCase() === t) ?? null;
}

function getPlainText(block) {
  if (!block) return "";
  if (block.content?.plain) return block.content.plain.trim();
  if (block.content?.html)
    return block.content.html.replace(/<[^>]*>/g, "").trim();
  return "";
}

function parseProjectName(channelTitle) {
  if (channelTitle.startsWith("→")) {
    const after = channelTitle.slice(1).trim();
    return after || channelTitle.trim();
  }
  return channelTitle.trim();
}



const FADE_MS = 220;

// ─── Styled components ───────────────────────────────────

const Stage = styled.main`
  position: relative;
  min-height: calc(100dvh - 5rem);
  display: flex;
  flex-direction: column;
`;

const SlideGrid = styled(Grid)`
  flex: 1;
  min-height: calc(100dvh - 5rem);
  grid-template-rows: 1fr auto;
  align-content: stretch;
`;

const SlideContent = styled.div`
  flex: 1;
  opacity: ${(p) => (p.$isVisible ? 1 : 0)};
  transition: opacity ${FADE_MS}ms ease;
`;

const ImageWrap = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
    max-height: calc(100dvh - 10rem);
  }
`;

const ImageCell = styled(GridCell)`
  display: flex;
  align-items: center;
`;

const Caption = styled.div`
  ${typeBody}
  padding-bottom: 1rem;
  text-align: center;
`;

/** Matches `StyledNavLink` in Navigation — same as site nav, without uppercase. */
const MetaLine = styled.div`
  ${typeSmall}
  color: inherit;
  text-transform: none;
  text-align: center;
  padding-bottom: 1rem;
  font-size: 1rem;
  width: 100%;
`;

const NavButton = styled.button`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  z-index: 1;
  cursor: none;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid var(--color-accent-green);
    outline-offset: -2px;
  }
`;

const PrevButton = styled(NavButton)`
  left: 0;

  @media ${GRID.MEDIA_MOBILE} {
    width: 30%;
  }
`;

const NextButton = styled(NavButton)`
  right: 0;

  @media ${GRID.MEDIA_MOBILE} {
    width: 70%;
  }
`;

const CustomCursor = styled.div`
  position: fixed;
  pointer-events: none;
  z-index: 2;
  ${typeArrow}
  transform: translate(-50%, -50%);
  user-select: none;

  @media (hover: none) {
    display: none;
  }
`;

// ─── Component ───────────────────────────────────────────

function Past() {
  const [projects, setProjects] = useState(null);
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [cursor, setCursor] = useState(null);
  const transitioningRef = useRef(false);
  const pendingIndexRef = useRef(null);
  const refreshKey = useArenaRefresh();

  const handleMouseMove = useCallback((e, arrow) => {
    setCursor({ x: e.clientX, y: e.clientY, arrow });
  }, []);
  const handleMouseLeave = useCallback(() => setCursor(null), []);

  useEffect(() => {
    let cancelled = false;
    const skipCache = refreshKey > 0;

    async function load() {
      const contents = await getChannelContentsByTitle("Page / Past", undefined, { skipCache });

      const pastChannels = contents.filter(
        (item) =>
          item.type === "Channel" &&
          typeof item.title === "string" &&
          item.title.startsWith("→")
      );

      const loaded = await Promise.all(
        pastChannels.map(async (channel) => {
          const slug = channel.slug ?? String(channel.id);
          const channelContents = await fetchAllChannelContents(slug, { skipCache });

          if (import.meta.env.DEV) {
            console.log("[Past] → channel:", channel.title, {
              slug,
              totalBlocks: channelContents.length,
              titles: channelContents.map((b) => b.title),
              types: channelContents.map((b) => b.type),
            });
          }

          const imageBlock = findByTitle(channelContents, "Image")
            ?? channelContents.find((b) => getImageUrl(b));
          const imageUrl = getImageUrl(imageBlock);
          const name = parseProjectName(channel.title);
          const client = getPlainText(findByTitle(channelContents, "Client"));

          return { channel, imageUrl, name, client };
        })
      );

      if (!cancelled) {
        setProjects(loaded);
      }
    }

    load().catch((err) => console.error("Past: fetch failed", err));
    return () => { cancelled = true; };
  }, [refreshKey]);

  const showSlide = useCallback(() => {
    setIsVisible(true);
    transitioningRef.current = false;
  }, []);

  const handleImageLoad = useCallback(() => {
    if (pendingIndexRef.current !== null) {
      pendingIndexRef.current = null;
      showSlide();
    }
  }, [showSlide]);

  const changeSlide = useCallback((direction) => {
    if (!projects || transitioningRef.current) return;
    transitioningRef.current = true;

    const nextIndex = direction === "prev"
      ? (index <= 0 ? projects.length - 1 : index - 1)
      : (index >= projects.length - 1 ? 0 : index + 1);

    setIsVisible(false);

    setTimeout(() => {
      pendingIndexRef.current = nextIndex;
      setIndex(nextIndex);

      const nextUrl = projects[nextIndex]?.imageUrl;
      if (!nextUrl) {
        showSlide();
      }
      // else: handleImageLoad will call showSlide when the <img> fires onLoad
    }, FADE_MS);
  }, [projects, index, showSlide]);

  const prev = useCallback(() => changeSlide("prev"), [changeSlide]);
  const next = useCallback(() => changeSlide("next"), [changeSlide]);

  const current = projects?.[index];
  const { imageUrl, name, client } = current ?? {};

  return (
    <>
    <LoadingOverlay isLoaded={!!projects} />
    {projects && projects.length === 0 && (
      <Stage>
        <Grid as="div">
          <GridCell $span={12} $spanMobile={4}>
            <Caption>No past projects found.</Caption>
          </GridCell>
        </Grid>
      </Stage>
    )}
    {projects && projects.length > 0 && <Stage>
      <PrevButton
        type="button"
        aria-label="Previous project"
        onClick={prev}
        onMouseMove={(e) => handleMouseMove(e, "←")}
        onMouseLeave={handleMouseLeave}
      />
      <NextButton
        type="button"
        aria-label="Next project"
        onClick={next}
        onMouseMove={(e) => handleMouseMove(e, "→")}
        onMouseLeave={handleMouseLeave}
      />

      {cursor && (
        <CustomCursor style={{ left: cursor.x, top: cursor.y }}>
          {cursor.arrow}
        </CustomCursor>
      )}

      <SlideContent $isVisible={isVisible}>
        <SlideGrid as="div">
          <ImageCell
            $rowStart={1}
            $rowSpan={1}
            $start={2}
            $span={10}
            $startTablet={2}
            $spanTablet={6}
            $spanMobile={4}
          >
            {imageUrl && (
              <ImageWrap>
                <img
                  src={imageUrl}
                  alt={name}
                  onLoad={handleImageLoad}
                  onError={handleImageLoad}
                />
              </ImageWrap>
            )}
          </ImageCell>

          <GridCell
            $rowStart={2}
            $rowSpan={1}
            $start={1}
            $span={12}
            $startTablet={1}
            $spanTablet={8}
            $spanMobile={4}
          >
            <MetaLine>
              {[name, client].filter(Boolean).join(", ")}
            </MetaLine>
          </GridCell>
        </SlideGrid>
      </SlideContent>
    </Stage>}
    </>
  );
}

export default Past;
