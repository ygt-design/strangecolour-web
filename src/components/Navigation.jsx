import { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { Grid, GridCell, GRID } from "../grid";
import { LOADER_NAV_HANDOFF } from "../loaderNavHandoff.js";
import { typeSmallMixed } from "../styles";

const HeaderBar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: white;
  padding-block: 1rem;
`;

const MobileNavSection = styled.div`
  display: none;
  @media ${GRID.MEDIA_MOBILE} {
    display: block;
    width: 100%;
  }
`;

const MobileNavGrid = styled(Grid)`
  @media ${GRID.MEDIA_MOBILE} {
    row-gap: 0;
  }
`;

const MobileNavRow = styled.nav`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  width: 100%;
  min-width: 0;
  padding: 0;
  overflow: hidden;
`;

const DesktopNav = styled(Grid)`
  align-items: center;

  @media ${GRID.MEDIA_MOBILE} {
    display: none;
  }
`;

const LeftCluster = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  justify-content: flex-start;
`;

const CenterLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
`;

const RightCluster = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  justify-content: flex-end;
`;

const StyledNavLink = styled(NavLink)`
  ${typeSmallMixed}
  line-height: 1.5;
  display: inline-flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  &:hover,
  &:focus-visible {
    color: var(--color-accent-green);
  }
  &.active {
    color: var(--color-accent-green);
  }

  @media ${GRID.MEDIA_MOBILE} {
    line-height: 1.25;
  }
`;

const LogoBox = styled.div`
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  overflow: visible;
  opacity: ${(p) => (p.$concealed ? 0 : 1)};
  visibility: ${(p) => (p.$concealed ? "hidden" : "visible")};
  @media ${GRID.MEDIA_MOBILE} {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const GlyphChar = styled.span`
  font-family: 'Citerne', system-ui, sans-serif;
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1;
  color: black;
  display: flex;
  align-items: center;
  justify-content: center;
  @media ${GRID.MEDIA_MOBILE} {
    font-size: 1.1rem;
  }
`;

const GreenSquare = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--color-accent-green);
`;

const GLYPHS = "ÆĐ&CﬀZß≈×#STKP";
const SHUFFLE_INTERVAL = 120;
const SHUFFLE_COUNT = 8;
const HOLD_DURATION = 1000;
/** Keep green square on nav after loader lands before shuffle resumes. */
const POST_HANDOFF_GREEN_MS = 500;

function GlyphLogo() {
  const [phase, setPhase] = useState("hold"); // "shuffle" | "hold"
  const [glyph, setGlyph] = useState("");
  const [loaderHandoff, setLoaderHandoff] = useState(false);
  const tickRef = useRef(0);
  /**
   * After loader handoff ends: delay (ms) before shuffle. `null` = use HOLD_DURATION (initial mount).
   */
  const resumeShuffleDelayRef = useRef(null);

  useEffect(() => {
    const onHandoff = (e) => {
      const active = !!e.detail?.active;
      if (active) setPhase("hold");
      else resumeShuffleDelayRef.current = POST_HANDOFF_GREEN_MS;
      setLoaderHandoff(active);
    };
    window.addEventListener(LOADER_NAV_HANDOFF, onHandoff);
    return () => window.removeEventListener(LOADER_NAV_HANDOFF, onHandoff);
  }, []);

  useEffect(() => {
    if (loaderHandoff) return;
    let timer;

    function shuffle() {
      setPhase("shuffle");
      setGlyph(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
      tickRef.current = 1;

      timer = setInterval(() => {
        setGlyph(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
        tickRef.current++;

        if (tickRef.current >= SHUFFLE_COUNT) {
          clearInterval(timer);
          setPhase("hold");
          timer = setTimeout(shuffle, HOLD_DURATION);
        }
      }, SHUFFLE_INTERVAL);
    }

    const delay =
      resumeShuffleDelayRef.current != null
        ? resumeShuffleDelayRef.current
        : HOLD_DURATION;
    if (resumeShuffleDelayRef.current != null) resumeShuffleDelayRef.current = null;
    timer = setTimeout(shuffle, delay);
    return () => { clearInterval(timer); clearTimeout(timer); };
  }, [loaderHandoff]);

  const showGreen = loaderHandoff || phase === "hold";

  return (
    <LogoBox
      aria-hidden
      data-nav-glyph-logo
      $concealed={loaderHandoff}
    >
      {showGreen ? <GreenSquare /> : <GlyphChar>{glyph}</GlyphChar>}
    </LogoBox>
  );
}

function Navigation() {
  return (
    <HeaderBar>
      <MobileNavSection>
        <MobileNavGrid as="div">
          <GridCell $startMobile={1} $spanMobile={4}>
            <MobileNavRow aria-label="Primary">
              <StyledNavLink to="/" end>
                Current
              </StyledNavLink>
              <StyledNavLink to="/past">Past</StyledNavLink>
              <StyledNavLink to="/project-list" end>
                Project List
              </StyledNavLink>
              <StyledNavLink to="/our-practice">Our Practice</StyledNavLink>
              <GlyphLogo />
            </MobileNavRow>
          </GridCell>
        </MobileNavGrid>
      </MobileNavSection>

      <DesktopNav as="nav" aria-label="Primary">
        <GridCell
          $start={1}
          $span={4}
          $startTablet={1}
          $spanTablet={3}
          $spanMobile={4}
        >
          <LeftCluster>
            <StyledNavLink to="/" end>
              Current
            </StyledNavLink>
            <StyledNavLink to="/past">Past</StyledNavLink>
          </LeftCluster>
        </GridCell>
        <GridCell
          $start={5}
          $span={4}
          $startTablet={4}
          $spanTablet={2}
          $spanMobile={4}
        >
          <CenterLabel>
            <StyledNavLink to="/project-list" end>
              Project List
            </StyledNavLink>
          </CenterLabel>
        </GridCell>
        <GridCell
          $start={9}
          $span={4}
          $startTablet={6}
          $spanTablet={3}
          $spanMobile={4}
        >
          <RightCluster>
            <StyledNavLink to="/our-practice">Our Practice</StyledNavLink>
            <GlyphLogo />
          </RightCluster>
        </GridCell>
      </DesktopNav>
    </HeaderBar>
  );
}

export default Navigation;
