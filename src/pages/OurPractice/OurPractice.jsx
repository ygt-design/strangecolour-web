import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  getBlock,
  getChannelContentsByTitle,
  useArenaRefresh,
} from "../../arena";
import { Grid, GridCell, GRID } from "../../grid";
import {
  typeBody,
  typeHeadingLg,
  typeSmallList,
  typeSmallListStackedItems,
  typeSmallListStackedLeaf,
} from "../../styles";
import LoadingOverlay from "../../components/LoadingOverlay";
import scarrowUrl from "../../assets/SCARROW.svg";

gsap.registerPlugin(ScrollTrigger);

const EASE = "cubic-bezier(0.1,0.7,0.5,1)";
/** Pause after Lead/Body word animation before hero image fades in. */
const IMAGE_DELAY_AFTER_TEXT_S = 0.05;

/** Site sets the donations row title in code; Are.na block "Donations" is the list only. */
const DEFAULT_DONATIONS_INTRO =
  "We are currently supporting these initiatives with financial or services-based donations";

const DEFAULT_DONATIONS_ORGS = [
  "Daily Bread Food Bank",
  "Minden Community Food Centre",
  "NWAC",
  "Options Mississauga",
  "Red Cross Canada",
];

const LEGAL_PHOTO_CREDITS = [
  "Tom Arban — Limberlost Place, The Interchange, 90 Queen West",
  "Name — Project, Project, Project",
  "Name — Project, Project, Project",
  "Name — Project, Project, Project",
];

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

// ─── Helpers ─────────────────────────────────────────────

function findByTitle(items, title) {
  const t = title.toLowerCase();
  return items.find((item) => item.title?.toLowerCase() === t) ?? null;
}

/** First matching block — helps when Are.na titles vary slightly from the canonical name. */
function findFirstByTitles(items, titles) {
  for (const title of titles) {
    const b = findByTitle(items, title);
    if (b) return b;
  }
  return null;
}

function hasHtmlTags(text) {
  return /<\/?[a-z][\s\S]*>/i.test(String(text ?? ""));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainToHtml(text) {
  const value = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!value) return "";
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${paragraph.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

function stripHtml(html) {
  return String(html ?? "").replace(/<[^>]*>/g, "").trim();
}

/**
 * Text from Are.na / strangecolor-cms: usually `content` on Text blocks; channel listings
 * sometimes omit fields, so we also read `description` and can refetch via `getBlock` in the loader.
 */
function getBlockContent(block) {
  if (!block) return { html: "", plain: "", isRich: false };

  const tryFields = (plainRaw, htmlRaw) => {
    const plain = String(plainRaw ?? "").trim();
    const htmlFromApi = String(htmlRaw ?? "").trim();
    if (hasHtmlTags(plain)) {
      return { html: plain, plain: stripHtml(plain), isRich: true };
    }
    if (htmlFromApi) {
      return { html: htmlFromApi, plain: stripHtml(htmlFromApi), isRich: true };
    }
    if (plain) {
      return { html: plainToHtml(plain), plain, isRich: false };
    }
    return null;
  };

  const c = block.content;
  if (typeof c === "string" && c.trim()) {
    const r = tryFields(c, "");
    if (r) return r;
  }
  if (c && typeof c === "object") {
    const r = tryFields(c.plain, c.html);
    if (r) return r;
  }

  const d = block.description;
  if (d && typeof d === "object") {
    const r = tryFields(d.plain, d.html);
    if (r) return r;
  }

  return { html: "", plain: "", isRich: false };
}

/**
 * Are.na / markdown HTML often drops “soft” line breaks; any literal `\n` left in text
 * nodes is collapsed to a space in the browser. Turn those into `<br>` so returns match the editor.
 */
function normalizeLegalHtmlNewlines(html) {
  if (!html || typeof document === "undefined") return html;
  try {
    let source = String(html);
    // Some CMS/Are.na payloads arrive as HTML-escaped strings (`&lt;p&gt;...`).
    // Decode once so markup renders as markup instead of literal tag text.
    if (!hasHtmlTags(source) && /&lt;\/?[a-z][\s\S]*?&gt;/i.test(source)) {
      const decoder = document.createElement("textarea");
      decoder.innerHTML = source;
      source = decoder.value;
    }

    const doc = new DOMParser().parseFromString(source, "text/html");
    const { body } = doc;

    function walk(node) {
      const children = [...node.childNodes];
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent ?? "";
          if (!text.includes("\n")) continue;
          const parent = child.parentNode;
          if (!parent) continue;
          const parts = text.split("\n");
          const frag = doc.createDocumentFragment();
          parts.forEach((part, i) => {
            frag.appendChild(doc.createTextNode(part));
            if (i < parts.length - 1) frag.appendChild(doc.createElement("br"));
          });
          parent.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName?.toLowerCase();
          if (tag === "script" || tag === "style" || tag === "pre") continue;
          walk(child);
        }
      }
    }

    walk(body);
    return body.innerHTML;
  } catch {
    return html;
  }
}

function getImageUrl(block) {
  if (!block) return null;
  const img = block.image;
  if (img) {
    return img.src ?? img.display?.url ?? img.original?.url ?? img.large?.src ?? null;
  }
  return null;
}

/** Core service titles — start of line (sentence case in CMS). */
function isCoreServiceLine(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  return (
    /^signage\s*\+\s*wayfinding\b/i.test(t)
    || /^spatial\s+graphics\b/i.test(t)
    || /^interpretive\s+displays\b/i.test(t)
    || /^identity\s*\+\s*collateral\b/i.test(t)
  );
}

function classifyServiceBlock(el) {
  const raw = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return isCoreServiceLine(raw) ? "core" : "secondary";
}

function groupConsecutiveByType(items, typeFn) {
  const groups = [];
  let curType = null;
  let bucket = [];
  for (const item of items) {
    const t = typeFn(item);
    if (curType !== null && t !== curType && bucket.length) {
      groups.push({ type: curType, items: bucket });
      bucket = [];
    }
    curType = t;
    bucket.push(item);
  }
  if (bucket.length) groups.push({ type: curType, items: bucket });
  return groups;
}

/** Split one list into contiguous core vs secondary `<ul>` / `<ol>` blocks (client-only). */
function splitServiceList(ul) {
  const tag = ul.tagName.toLowerCase();
  const lis = [...ul.children].filter((c) => c.tagName === "LI");
  if (!lis.length) {
    ul.classList.add("services-secondary-block");
    return [ul];
  }
  return groupConsecutiveByType(lis, classifyServiceBlock).map(({ type, items }) => {
    const list = document.createElement(tag);
    list.className = type === "core" ? "services-core-block" : "services-secondary-block";
    items.forEach((li) => list.appendChild(li));
    return list;
  });
}

/**
 * Restructure Scope HTML: core services in layout column 1; small caps in column 2.
 */
function restructureServicesHtml(html) {
  if (!html || typeof document === "undefined") return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="svc-root">${html}</div>`, "text/html");
    const root = doc.getElementById("svc-root");
    if (!root) return html;

    const blocks = [];
    function walk(parent) {
      for (const child of [...parent.childNodes]) {
        if (child.nodeType !== 1) continue;
        const el = /** @type {Element} */ (child);
        if (el.tagName === "UL" || el.tagName === "OL") {
          blocks.push({ kind: "list", el });
        } else if (el.tagName === "P") {
          blocks.push({ kind: "p", el });
        } else {
          walk(el);
        }
      }
    }
    walk(root);

    if (!blocks.length) return html;

    const coreCol = doc.createElement("div");
    coreCol.className = "services-core-column";
    const secCol = doc.createElement("div");
    secCol.className = "services-secondary-column";

    const appendTo = (node, col) => {
      col.appendChild(node);
    };

    let idx = 0;
    while (idx < blocks.length) {
      const b = blocks[idx];
      if (b.kind === "list") {
        splitServiceList(b.el).forEach((list) => {
          appendTo(list, list.classList.contains("services-core-block") ? coreCol : secCol);
        });
        idx += 1;
        continue;
      }
      const ps = [];
      while (idx < blocks.length && blocks[idx].kind === "p") {
        ps.push(blocks[idx].el);
        idx += 1;
      }
      for (const { type, items } of groupConsecutiveByType(ps, classifyServiceBlock)) {
        if (type === "core") {
          items.forEach((p) => {
            p.classList.add("services-core-line");
            appendTo(p, coreCol);
          });
        } else {
          const wrap = doc.createElement("div");
          wrap.className = "services-secondary-block";
          items.forEach((p) => wrap.appendChild(p));
          appendTo(wrap, secCol);
        }
      }
    }

    const layout = doc.createElement("div");
    layout.className = "services-layout";
    if (!coreCol.childNodes.length) layout.classList.add("services-layout--secondary-only");
    if (!secCol.childNodes.length) layout.classList.add("services-layout--core-only");
    layout.appendChild(coreCol);
    layout.appendChild(secCol);

    root.innerHTML = "";
    root.appendChild(layout);
    return root.innerHTML;
  } catch {
    return html;
  }
}

// ─── Styled components ───────────────────────────────────

const Page = styled.main`
  padding-bottom: 4rem;
`;

const Section = styled.div`
  margin-bottom: 2rem;

  @media (max-width: ${GRID.BREAKPOINT}) {
    margin-bottom: 0rem;
  }
`;

const LeadText = styled.div`
  ${typeHeadingLg}
  font-weight: 400;
`;

/** Wider than default body (8 cols from grid start); scaled above `typeBody` for a fuller line. */
const BodyText = styled.div`
  ${typeBody}
  font-size: clamp(1.22rem, 2.75vw, 1.78rem);
  line-height: 1.32;
  margin-bottom: 2.5rem;
  color: rgb(0, 0, 0);

  /* Are.na / pasted HTML often ships muted inline colors — match lead copy (solid black). */
  * {
    color: inherit !important;
  }

  a {
    text-decoration: none;
    &:hover,
    &:focus-visible {
      color: var(--color-accent-green) !important;
    }
  }

  p {
    margin-bottom: 0.75em;
  }

  p:last-child {
    margin-bottom: 0;
  }

  @media (max-width: ${GRID.BREAKPOINT}) {
    margin-bottom: 1rem;
  }
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  overflow: hidden;
  margin: 5rem 0;

  @media (max-width: ${GRID.BREAKPOINT}) {
    margin: 1rem 0;
  }
`;

const BgImage = styled.div`
  width: 100%;
  aspect-ratio: ${(p) => p.$aspect ?? "3 / 2"};
  background-image: url(${(p) => p.$src});
  background-size: cover;
  background-position: center;
`;

const ForegroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.45s ease;
  opacity: 1;

  ${ImageContainer}:hover & {
    opacity: 0;
  }
`;

/** `typeBody` for Services (Scope) & Contact — single column, no list bullets. */
const PracticeBodyBlock = styled.div`
  ${typeBody}
  line-height: 1.35;

  p {
    margin: 0 0 0.6em 0;
  }

  p:last-child {
    margin-bottom: 0;
  }

  ul,
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin: 0 0 0.35em 0;
    padding: 0;
  }

  li:last-child {
    margin-bottom: 0;
  }

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      color: var(--color-accent-green);
    }
  }
`;

/** Scope: core column (left) + small caps column (right) inside the 5–12 grid cell. */
const PracticeServicesBody = styled(PracticeBodyBlock)`
  .services-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: ${GRID.GAP}px;
    align-items: start;
  }

  .services-layout--core-only,
  .services-layout--secondary-only {
    grid-template-columns: 1fr;
  }

  .services-core-block li,
  p.services-core-line {
    font-weight: 500;
    text-transform: none;
  }

  .services-core-column ul,
  .services-core-column ol {
    margin: 0 0 0.5em 0;
  }

  .services-core-column ul:last-child,
  .services-core-column ol:last-child,
  .services-core-column p:last-child {
    margin-bottom: 0;
  }

  ul.services-secondary-block,
  ol.services-secondary-block,
  div.services-secondary-block {
    ${typeSmallList}
    margin: 0 0 0.5em 0;
    padding: 0;
    list-style: none;
  }

  .services-secondary-column > :last-child {
    margin-bottom: 0;
  }

  ul.services-secondary-block li,
  ol.services-secondary-block li,
  div.services-secondary-block p {
    ${typeSmallListStackedLeaf}
  }

  div.services-secondary-block p:last-child,
  ul.services-secondary-block li:last-child,
  ol.services-secondary-block li:last-child {
    margin-bottom: 0;
  }

  @media ${GRID.MEDIA_TABLET} {
    .services-layout {
      column-gap: ${GRID.GAP_TABLET};
    }
  }

  @media ${GRID.MEDIA_MOBILE} {
    .services-layout {
      grid-template-columns: 1fr;
      row-gap: 1rem;
    }

    .services-layout--core-only,
    .services-layout--secondary-only {
      row-gap: 0;
    }
  }
`;

/** Two balanced columns — Collaborators + Donations (`typeSmallList` + Project List–matched stack). */
const PracticeTwoColumnList = styled.div`
  ${typeSmallList}
  column-count: 2;
  column-gap: ${GRID.GAP}px;
  column-fill: balance;

  @media ${GRID.MEDIA_TABLET} {
    column-gap: ${GRID.GAP_TABLET};
  }

  @media ${GRID.MEDIA_MOBILE} {
    column-count: 1;
    column-gap: 0;
  }

  ${typeSmallListStackedItems}
`;

/** Matches paragraph column (`PracticeBodyBlock`); one step heavier; sentence case. */
const PracticeRowTitle = styled.h2`
  ${typeBody}
  margin: 0;
  font-weight: 500;
  line-height: 1.35;
  text-transform: none;
  color: rgb(0, 0, 0);
  padding-right: 100px;

  @media ${GRID.MEDIA_TABLET} {
    padding-right: 0;
  }
`;

const PracticeRowListCell = styled(GridCell)`
  margin-bottom: 2rem;

  @media ${GRID.MEDIA_MOBILE} {
    margin-bottom: 0;
    margin-top: -1.25rem;
  }
`;

/** Left column band — aligns “Notes and Legal” to the page's left edge. */
const LegalFooterCell = styled(GridCell)`
  display: flex;
  justify-content: flex-start;
`;

const LegalFooterTrigger = styled.button`
  ${typeBody}
  display: block;
  margin: 2.5rem 0 0 0;
  padding: 0;
  font-weight: 400;
  line-height: 1.35;
  text-transform: none;
  color: rgb(0, 0, 0);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  width: fit-content;
  max-width: 100%;

  &:hover,
  &:focus-visible {
    color: var(--color-accent-green);
  }

  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
`;

/** Full viewport layer; scrollable content lives inside. */
const LegalModalRoot = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10050;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #fff;
  outline: none;

  &:focus-visible {
    outline: 2px solid rgb(0 0 0 / 0.2);
    outline-offset: -2px;
  }
`;

/** Full-height shell; horizontal padding comes from inner <Grid> (same as the rest of the page). */
const LegalModalShell = styled.div`
  box-sizing: border-box;
  min-height: 100%;
  padding-top: calc(3.75rem + 2rem);
  padding-bottom: 4rem;
`;

const LegalModalBackButton = styled.button`
  position: fixed;
  left: ${GRID.PADDING}px;
  bottom: 2.5rem;
  z-index: 10060;
  width: clamp(1.5rem, 4.5vw, 2.4rem);
  height: clamp(1.5rem, 4.5vw, 2.4rem);
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: rgb(0, 0, 0);

  &:hover,
  &:focus-visible {
    color: var(--color-accent-green);
  }

  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  @media ${GRID.MEDIA_TABLET} {
    left: ${GRID.PADDING_TABLET}px;
  }

  @media ${GRID.MEDIA_MOBILE} {
    left: ${GRID.PADDING_MOBILE}px;
  }
`;

const LegalModalBackArrow = styled.img`
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  transform: rotate(180deg);
  filter: brightness(0);

  ${LegalModalBackButton}:hover &,
  ${LegalModalBackButton}:focus-visible & {
    filter: none;
  }
`;

/**
 * Notes & Legal sheet — quiet reference layout: sentence case, black on white,
 * comfortable line length feel (~1.5 leading), clear space between blocks.
 */
const LEGAL_MODAL_BLOCK_GAP = "1.1em";
const LEGAL_MODAL_LIST_GAP = "0.35em";

const legalModalCopy = css`
  font-family: inherit;
  font-weight: 400;
  font-size: clamp(1.05rem, 2.15vw, 1.35rem);
  line-height: 1.5;
  color: #000;
  text-align: left;
  text-transform: none;
  white-space: normal;

  strong,
  b {
    font-weight: 500;
  }
`;

const LegalModalBody = styled.div`
  ${legalModalCopy}
  display: flex;
  flex-direction: column;
  gap: ${LEGAL_MODAL_BLOCK_GAP};
  align-items: stretch;

  p {
    margin: 0;
  }
`;

const LegalModalPhotoLabel = styled.p`
  ${legalModalCopy}
  margin: ${LEGAL_MODAL_BLOCK_GAP} 0 ${LEGAL_MODAL_LIST_GAP} 0;
`;

const LegalModalPhotoList = styled.ul`
  ${legalModalCopy}
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${LEGAL_MODAL_LIST_GAP};
`;

const LegalModalPhotoItem = styled.li`
  margin: 0;
`;

/** CMS HTML — same typographic treatment; flex gap registers space between block items. */
const LegalModalRichBody = styled.div`
  ${legalModalCopy}
  display: flex;
  flex-direction: column;
  gap: ${LEGAL_MODAL_BLOCK_GAP};
  align-items: stretch;

  * {
    color: inherit !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
  }

  p {
    margin: 0;
  }

  ul,
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: ${LEGAL_MODAL_LIST_GAP};
  }

  ul li,
  ol li {
    margin: 0;
    padding: 0;
    text-transform: none;
  }

  a {
    text-decoration: underline;
    text-underline-offset: 0.15em;

    &:hover,
    &:focus-visible {
      color: var(--color-accent-green) !important;
      text-decoration-color: var(--color-accent-green);
    }
  }
`;

// ─── Component ───────────────────────────────────────────

function OurPractice() {
  const [data, setData] = useState(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const legalTriggerRef = useRef(null);
  const legalModalRef = useRef(null);
  const refreshKey = useArenaRefresh();

  const closeLegalModal = useCallback(() => {
    setLegalModalOpen(false);
  }, []);

  const textRefs = useRef([]);
  const sectionPairs = useRef([]);
  const imageRef = useRef(null);
  const hasAnimatedText = useRef(false);

  const setSectionRef = useCallback((pairIndex, slot, el) => {
    if (!el) return;
    if (!sectionPairs.current[pairIndex]) sectionPairs.current[pairIndex] = {};
    sectionPairs.current[pairIndex][slot] = el;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const skipCache = refreshKey > 0;

    async function load() {
      const contents = await getChannelContentsByTitle("Page / Our Practice", undefined, { skipCache });

      if (import.meta.env.DEV) {
        console.log("[OurPractice] contents:", contents.map((b) => ({
          title: b.title,
          type: b.type,
          position: b.connection?.position,
        })));
      }

      const lead = getBlockContent(findByTitle(contents, "Lead"));
      const body = getBlockContent(findByTitle(contents, "Body"));
      const imageBlock = findByTitle(contents, "Image");
      const bgImageBlock = findByTitle(contents, "bg-Image");
      const scope = getBlockContent(findByTitle(contents, "Scope"));
      const contact = getBlockContent(findByTitle(contents, "Contact"));
      const collaborators = getBlockContent(findByTitle(contents, "Collaborators"));
      const donations = getBlockContent(findByTitle(contents, "Donations"));
      const notesLegalBlock = findFirstByTitles(contents, [
        "Notes and Legal",
        "Notes & Legal",
        "Notes + Legal",
        "Notes and legal",
        "Legal notes",
      ]);
      let notesLegal = getBlockContent(notesLegalBlock);
      if (notesLegalBlock?.id) {
        try {
          const full = await getBlock(String(notesLegalBlock.id), { skipCache });
          const fullContent = getBlockContent(full);
          if (stripHtml(fullContent.html).length) {
            notesLegal = fullContent;
          }
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn("[OurPractice] Notes and Legal: full block fetch failed", e);
          }
        }
      }

      notesLegal = {
        ...notesLegal,
        html: normalizeLegalHtmlNewlines(notesLegal.html),
      };

      const imageUrl = getImageUrl(imageBlock);
      const bgImageUrl = getImageUrl(bgImageBlock);
      const imageAspect = imageBlock?.image
        ? imageBlock.image.width / imageBlock.image.height
        : null;

      if (!cancelled) {
        setData({
          lead,
          body,
          imageUrl,
          bgImageUrl,
          imageAspect,
          scope,
          contact,
          collaborators,
          donations,
          notesLegal,
        });
      }
    }

    load().catch((err) => console.error("OurPractice: fetch failed", err));
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Word-by-word text entrance for Lead + Body; hero image fades in shortly after
  useEffect(() => {
    if (!data || hasAnimatedText.current) return;
    hasAnimatedText.current = true;

    const texts = textRefs.current.filter(Boolean);
    const allWords = [];
    texts.forEach((el) => {
      el.style.opacity = "1";
      allWords.push(...wrapWords(el));
    });

    const fadeInHeroImage = () => {
      const img = imageRef.current;
      if (!img) return;
      gsap.to(img, {
        opacity: 1,
        duration: 0.8,
        ease: "power2.out",
        delay: IMAGE_DELAY_AFTER_TEXT_S,
      });
    };

    if (allWords.length) {
      gsap.fromTo(
        allWords,
        { opacity: 0, y: "0.3em" },
        {
          opacity: 1,
          y: 0,
          duration: 0.25,
          stagger: 0.012,
          ease: EASE,
          onComplete: fadeInHeroImage,
        },
      );
    } else {
      fadeInHeroImage();
    }
  }, [data]);

  // Project-list-style staggered entrance for section rows
  useEffect(() => {
    if (!data) return;

    const pairs = sectionPairs.current.filter(Boolean);
    if (!pairs.length) return;

    const allEls = pairs.flatMap((p) => [p.title, p.content].filter(Boolean));
    gsap.set(allEls, { opacity: 0, y: 6 });

    const triggers = pairs.map((pair) => {
      const els = [pair.title, pair.content].filter(Boolean);
      return ScrollTrigger.create({
        trigger: pair.title || pair.content,
        start: "top 90%",
        once: true,
        onEnter: () => {
          gsap.fromTo(
            els,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: 0.35, stagger: 0.025, ease: EASE },
          );
        },
      });
    });

    return () => triggers.forEach((t) => t.kill());
  }, [data]);

  useEffect(() => {
    if (!legalModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const triggerEl = legalTriggerRef.current;

    const focusId = window.setTimeout(() => {
      legalModalRef.current?.focus();
    }, 0);

    function onKeyDown(e) {
      if (e.key === "Escape") closeLegalModal();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusId);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      triggerEl?.focus();
    };
  }, [legalModalOpen, closeLegalModal]);

  // Parse contact text to linkify email and phone
  function renderContact(text) {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      // Email
      const emailMatch = trimmed.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        return (
          <div key={i}>
            <a href={`mailto:${emailMatch[0]}`}>{trimmed}</a>
          </div>
        );
      }

      // Phone
      if (/^\(?\+?\d/.test(trimmed)) {
        const digits = trimmed.replace(/[^\d+]/g, "");
        return (
          <div key={i}>
            <a href={`tel:${digits}`}>{trimmed}</a>
          </div>
        );
      }

      return <div key={i}>{trimmed}</div>;
    });
  }

  return (
    <>
    <LoadingOverlay isLoaded={!!data} />
    {data && <Page>
      <Grid as="div">
        {/* Lead */}
        <GridCell
          ref={(el) => { textRefs.current[0] = el; }}
          style={{ opacity: 0 }}
          $start={1}
          $span={12}
          $startTablet={1}
          $spanTablet={8}
          $spanMobile={4}
        >
          <Section>
            <LeadText dangerouslySetInnerHTML={{ __html: data.lead.html }} />
          </Section>
        </GridCell>

        {/* Body — column 1, wide span (8 desktop cols ≈ hero width; full width tablet) */}
        <GridCell
          ref={(el) => { textRefs.current[1] = el; }}
          style={{ opacity: 0 }}
          $start={1}
          $span={8}
          $startTablet={1}
          $spanTablet={8}
          $startMobile={1}
          $spanMobile={4}
        >
          <BodyText dangerouslySetInnerHTML={{ __html: data.body.html }} />
        </GridCell>

      </Grid>

      {/* Image with bg-Image hover reveal — own row, cols 5–12 */}
      {data.imageUrl && data.bgImageUrl && (
        <Grid as="div">
          <GridCell
            ref={imageRef}
            style={{ opacity: 0 }}
            $start={5}
            $span={8}
            $startTablet={4}
            $spanTablet={5}
            $startMobile={1}
            $spanMobile={4}
          >
            <ImageContainer>
              <BgImage
                $src={data.bgImageUrl}
                $aspect={data.imageAspect ? `${data.imageAspect}` : undefined}
              />
              <ForegroundImage
                src={data.imageUrl}
                alt="Our practice"
              />
            </ImageContainer>
          </GridCell>
        </Grid>
      )}

      <Grid as="div">

        {/* Services (Are.na "Scope") — title cols 1–4, single-column body cols 5–12 */}
        {data.scope?.plain && (
          <>
            <GridCell
              ref={(el) => setSectionRef(0, "title", el)}
              $start={1}
              $span={4}
              $startTablet={1}
              $spanTablet={3}
              $startMobile={1}
              $spanMobile={4}
              $alignSelf="start"
            >
              <PracticeRowTitle>Services</PracticeRowTitle>
            </GridCell>
            <PracticeRowListCell
              ref={(el) => setSectionRef(0, "content", el)}
              $start={5}
              $span={8}
              $startTablet={4}
              $spanTablet={5}
              $startMobile={1}
              $spanMobile={4}
              $alignSelf="start"
            >
              <PracticeServicesBody
                dangerouslySetInnerHTML={{ __html: restructureServicesHtml(data.scope.html) }}
              />
            </PracticeRowListCell>
          </>
        )}

        {/* Contact — same row grid as Services; body single column */}
        {data.contact?.plain && (
          <>
            <GridCell
              ref={(el) => setSectionRef(1, "title", el)}
              $start={1}
              $span={4}
              $startTablet={1}
              $spanTablet={3}
              $startMobile={1}
              $spanMobile={4}
              $alignSelf="start"
            >
              <PracticeRowTitle>Contact</PracticeRowTitle>
            </GridCell>
            <PracticeRowListCell
              ref={(el) => setSectionRef(1, "content", el)}
              $start={5}
              $span={8}
              $startTablet={4}
              $spanTablet={5}
              $startMobile={1}
              $spanMobile={4}
              $alignSelf="start"
            >
              {data.contact.isRich ? (
                <PracticeBodyBlock dangerouslySetInnerHTML={{ __html: data.contact.html }} />
              ) : (
                <PracticeBodyBlock>{renderContact(data.contact.plain)}</PracticeBodyBlock>
              )}
            </PracticeRowListCell>
          </>
        )}

        {/* Collaborators — title cols 1–4, list cols 5–12 */}
        {data.collaborators?.plain && (
          <>
            <GridCell
              ref={(el) => setSectionRef(2, "title", el)}
              $start={1}
              $span={4}
              $startTablet={1}
              $spanTablet={3}
              $startMobile={1}
              $spanMobile={4}
              $alignSelf="start"
            >
              <PracticeRowTitle>Collaborators, Inspiration + Thanks</PracticeRowTitle>
            </GridCell>
            <PracticeRowListCell
              ref={(el) => setSectionRef(2, "content", el)}
              $start={5}
              $span={8}
              $startTablet={4}
              $spanTablet={5}
              $startMobile={1}
              $spanMobile={4}
              $alignSelf="start"
            >
              <PracticeTwoColumnList dangerouslySetInnerHTML={{ __html: data.collaborators.html }} />
            </PracticeRowListCell>
          </>
        )}

        {/* Donations / support — title fixed in code; CMS block "Donations" = list (Collaborators-style) */}
        <>
          <GridCell
            ref={(el) => setSectionRef(3, "title", el)}
            $start={1}
            $span={4}
            $startTablet={1}
            $spanTablet={3}
            $startMobile={1}
            $spanMobile={4}
            $alignSelf="start"
          >
            <PracticeRowTitle>{DEFAULT_DONATIONS_INTRO}</PracticeRowTitle>
          </GridCell>
          <PracticeRowListCell
            ref={(el) => setSectionRef(3, "content", el)}
            $start={5}
            $span={8}
            $startTablet={4}
            $spanTablet={5}
            $startMobile={1}
            $spanMobile={4}
            $alignSelf="start"
          >
            {data.donations?.plain ? (
              <PracticeTwoColumnList dangerouslySetInnerHTML={{ __html: data.donations.html }} />
            ) : (
              <PracticeTwoColumnList>
                {DEFAULT_DONATIONS_ORGS.map((name) => (
                  <p key={name}>{name}</p>
                ))}
              </PracticeTwoColumnList>
            )}
          </PracticeRowListCell>
        </>
      </Grid>

      <Grid as="div">
        <LegalFooterCell
          $start={1}
          $span={4}
          $startTablet={1}
          $spanTablet={3}
          $startMobile={1}
          $spanMobile={4}
        >
          <LegalFooterTrigger
            ref={legalTriggerRef}
            type="button"
            onClick={() => setLegalModalOpen(true)}
          >
            Notes and Legal
          </LegalFooterTrigger>
        </LegalFooterCell>
      </Grid>
    </Page>}

    {legalModalOpen
      && typeof document !== "undefined"
      && createPortal(
        <LegalModalRoot
          ref={legalModalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Notes and Legal"
        >
          <LegalModalBackButton
            type="button"
            onClick={closeLegalModal}
            aria-label="Back"
          >
            <LegalModalBackArrow src={scarrowUrl} alt="" aria-hidden />
          </LegalModalBackButton>
          <LegalModalShell>
            <Grid as="div">
              <GridCell
                $start={1}
                $span={6}
                $startTablet={1}
                $spanTablet={4}
                $startMobile={1}
                $spanMobile={4}
                $alignSelf="start"
              >
                {stripHtml(data?.notesLegal?.html ?? "").length > 0 ? (
                  <LegalModalRichBody dangerouslySetInnerHTML={{ __html: data.notesLegal.html }} />
                ) : (
                  <>
                    <LegalModalBody>
                      <p>This website is built with Vite and React.</p>
                      <p>The typeface used is Citerne by FEED Type, Montreal.</p>
                      <p>
                        Unless otherwise credited or noted, all content is © 2018–2026 Strange
                        Colour Inc.
                        <br />
                        All rights reserved.
                      </p>
                      <p>
                        Every reasonable attempt has been made to identify authors and owners of
                        copyrights.
                        <br />
                        Please be in touch if you believe there is an error or omission, or for
                        image usage.
                      </p>
                    </LegalModalBody>
                    <LegalModalPhotoLabel>Additional select photography provided by:</LegalModalPhotoLabel>
                    <LegalModalPhotoList>
                      {LEGAL_PHOTO_CREDITS.map((line) => (
                        <LegalModalPhotoItem key={line}>{line}</LegalModalPhotoItem>
                      ))}
                    </LegalModalPhotoList>
                  </>
                )}
              </GridCell>
            </Grid>
          </LegalModalShell>
        </LegalModalRoot>,
        document.body,
      )}
    </>
  );
}

export default OurPractice;
