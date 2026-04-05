import { useState, useEffect, useRef } from "react";
import styled from "styled-components";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@#*†‡§¶•→←↑↓◆■□▲▼●○";
const SHUFFLE_INTERVAL = 100;
const SHUFFLE_COUNT = 8;
const HOLD_DURATION = 500;
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
  transition: opacity ${FADE_MS}ms ease;
  opacity: ${(p) => (p.$fading ? 0 : 1)};
  pointer-events: ${(p) => (p.$fading ? "none" : "auto")};
`;

const Box = styled.div`
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const GlyphChar = styled.span`
  font-family: 'Citerne', system-ui, sans-serif;
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: black;
`;

const Square = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--color-accent-green);
`;

function LoadingOverlay({ isLoaded }) {
  // If already loaded on first mount (cached data), skip entirely
  const [skipped] = useState(isLoaded);
  const [phase, setPhase] = useState("hold");
  const [glyph, setGlyph] = useState("");
  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(isLoaded);
  const tickRef = useRef(0);
  const [mountedAt] = useState(() => Date.now());

  // Glyph shuffle loop
  useEffect(() => {
    if (removed) return;
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
    return () => { clearInterval(timer); clearTimeout(timer); };
  }, [removed]);

  // Fade out once loaded + minimum time elapsed
  useEffect(() => {
    if (!isLoaded || fading || removed) return;

    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_VISIBLE - elapsed);

    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => setRemoved(true), FADE_MS);
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoaded, fading, removed]);

  if (removed) return null;

  return (
    <Overlay $fading={fading}>
      <Box>
        {phase === "hold" ? <Square /> : <GlyphChar>{glyph}</GlyphChar>}
      </Box>
    </Overlay>
  );
}

export default LoadingOverlay;
