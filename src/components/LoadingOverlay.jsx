import { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import styled from "styled-components";
import gsap from "gsap";
import { setLoaderNavHandoffActive } from "../loaderNavHandoff.js";

const GLYPHS = "ÆĐ&CﬀZß≈×#STKP";
const SHUFFLE_INTERVAL = 100;
const SHUFFLE_COUNT = 8;
const HOLD_DURATION = 500;
const MIN_VISIBLE = 1000;
const FADE_MS = 350;
const FLY_DURATION = 0.7;
const NAV_GREEN_OVERLAP_SEC = 0.1;

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  pointer-events: ${(p) => (p.$fading ? "none" : "auto")};
`;

/** White layer only — faded independently so the green box stays fully opaque during the flight. */
const OverlayBackdrop = styled.div`
  position: absolute;
  inset: 0;
  background: white;
  z-index: 0;
`;

const Box = styled.div`
  position: relative;
  z-index: 1;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const GlyphChar = styled.span`
  font-family: 'Citerne', system-ui, sans-serif;
  font-size: 144px;
  font-weight: 500;
  line-height: 1;
  color: black;
`;

const Square = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--color-accent-green);
`;

function getVisibleNavTarget() {
  const nodes = document.querySelectorAll("[data-nav-glyph-logo]");
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function LoadingOverlay({ isLoaded }) {
  const [phase, setPhase] = useState("hold");
  const [glyph, setGlyph] = useState("");
  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(isLoaded);
  const tickRef = useRef(0);
  const boxRef = useRef(null);
  const overlayRef = useRef(null);
  const backdropRef = useRef(null);
  const flyingRef = useRef(false);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (removed || fading) return;
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
  }, [removed, fading]);

  const beginExit = useCallback(() => {
    if (flyingRef.current) return;
    flyingRef.current = true;

    const boxEl = boxRef.current;
    const backdropEl = backdropRef.current;
    const target = getVisibleNavTarget();

    if (!boxEl || !backdropEl || !target || prefersReducedMotion) {
      if (backdropEl) {
        gsap.to(backdropEl, {
          opacity: 0,
          duration: FADE_MS / 1000,
          ease: "power2.in",
          onComplete: () => setRemoved(true),
        });
      } else {
        setRemoved(true);
      }
      return;
    }

    flushSync(() => {
      setPhase("hold");
    });

    const fromRect = boxEl.getBoundingClientRect();
    const toRect = target.getBoundingClientRect();

    setLoaderNavHandoffActive(true);

    gsap.set(boxEl, {
      position: "fixed",
      left: fromRect.left,
      top: fromRect.top,
      width: fromRect.width,
      height: fromRect.height,
      margin: 0,
      zIndex: 10000,
    });

    gsap.set(backdropEl, { opacity: 1 });

    const toCenterX = toRect.left + toRect.width / 2;
    const toCenterY = toRect.top + toRect.height / 2;
    const fromCenterX = fromRect.left + fromRect.width / 2;
    const fromCenterY = fromRect.top + fromRect.height / 2;
    const scale = toRect.width / fromRect.width;

    const tl = gsap.timeline({
      onComplete: () => setRemoved(true),
    });

    tl.to(backdropEl, {
      opacity: 0,
      duration: FLY_DURATION * 0.9,
      ease: "power2.out",
    }, 0);

    tl.to(boxEl, {
      x: toCenterX - fromCenterX,
      y: toCenterY - fromCenterY,
      scale,
      duration: FLY_DURATION,
      ease: "power3.inOut",
    }, 0);

    tl.call(
      () => {
        setLoaderNavHandoffActive(false);
      },
      [],
      FLY_DURATION,
    );

    tl.set(boxEl, { opacity: 0 }, FLY_DURATION + NAV_GREEN_OVERLAP_SEC);
  }, []);

  useEffect(() => {
    if (!isLoaded || fading || removed) return;

    const elapsed = Date.now() - mountedAt;
    const remaining = Math.max(0, MIN_VISIBLE - elapsed);

    const timer = setTimeout(() => {
      setFading(true);
      beginExit();
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoaded, fading, removed, mountedAt, beginExit]);

  if (removed) return null;

  return (
    <Overlay ref={overlayRef} $fading={fading}>
      <OverlayBackdrop ref={backdropRef} aria-hidden />
      <Box ref={boxRef}>
        {phase === "hold" ? <Square /> : <GlyphChar>{glyph}</GlyphChar>}
      </Box>
    </Overlay>
  );
}

export default LoadingOverlay;
