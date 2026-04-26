import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { Grid, GridCell, GRID } from "../grid";
import { typeSmallMixed } from "../styles";
import scLogo from "../assets/icons/SCLogo.gif";

const HeaderBar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: white;
  padding-top: 1rem;
  padding-bottom: 0.5rem;
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
  /* border: 1px solid red; */
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
  @media ${GRID.MEDIA_MOBILE} {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const LogoImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`;

function BrandLogo() {
  return (
    <LogoBox aria-hidden>
      <LogoImage src={scLogo} alt="" />
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
              <BrandLogo />
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
            <BrandLogo />
          </RightCluster>
        </GridCell>
      </DesktopNav>
    </HeaderBar>
  );
}

export default Navigation;
