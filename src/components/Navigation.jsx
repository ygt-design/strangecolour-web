import { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { Grid, GridCell, GRID } from "../grid";
import { typeSmall } from "../styles";

const HeaderBar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: white;
  padding-block: 0.5rem;
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
  gap: 0.75rem;
  justify-content: flex-end;
`;

const StyledNavLink = styled(NavLink)`
  ${typeSmall}
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
`;

const LogoBox = styled.div`
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  @media ${GRID.MEDIA_MOBILE} {
    width: 20px;
    height: 20px;
  }
`;

const GlyphChar = styled.span`
  font-family: 'Citerne', system-ui, sans-serif;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  color: black;
  @media ${GRID.MEDIA_MOBILE} {
    font-size: 22px;
  }
`;

const GreenSquare = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--color-accent-green);
`;

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@#*†‡§¶•→←↑↓◆■□▲▼●○";
const SHUFFLE_INTERVAL = 120;
const SHUFFLE_COUNT = 8;
const HOLD_DURATION = 1000;

function GlyphLogo() {
  const [phase, setPhase] = useState("hold"); // "shuffle" | "hold"
  const [glyph, setGlyph] = useState("");
  const tickRef = useRef(0);

  useEffect(() => {
    let timer;

    function shuffle() {
      setPhase("shuffle");
      tickRef.current = 0;

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

    timer = setTimeout(shuffle, HOLD_DURATION);
    return () => clearInterval(timer);
  }, []);

  return (
    <LogoBox aria-hidden>
      {phase === "hold" ? <GreenSquare /> : <GlyphChar>{glyph}</GlyphChar>}
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
