import { useState, useEffect } from "react";
import styled from "styled-components";
import scLogo from "../assets/icons/SCLogo.gif";

const MIN_VISIBLE = 1000;
const FADE_MS = 350;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  opacity: ${(p) => (p.$fading ? 0 : 1)};
  transition: opacity ${FADE_MS}ms ease;
  pointer-events: ${(p) => (p.$fading ? "none" : "auto")};
`;

const LogoImage = styled.img`
  width: 120px;
  height: 120px;
  object-fit: contain;
  display: block;
`;

function LoadingOverlay({ isLoaded }) {
  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(isLoaded);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!isLoaded || fading || removed) return;

    const elapsed = Date.now() - mountedAt;
    const remaining = Math.max(0, MIN_VISIBLE - elapsed);

    const timer = setTimeout(() => {
      setFading(true);
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoaded, fading, removed, mountedAt]);

  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => {
      setRemoved(true);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [fading]);

  if (removed) return null;

  return (
    <Overlay $fading={fading}>
      <LogoImage src={scLogo} alt="" aria-hidden />
    </Overlay>
  );
}

export default LoadingOverlay;
