import { useState, useEffect, useRef, useCallback } from "react";
import styled from "styled-components";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  getChannelContentsByTitle,
  useArenaRefresh,
} from "../../arena";
import { Grid, GridCell, GRID } from "../../grid";
import { typeBody, typeHeadingLgLight, typeCaption, typeSmall } from "../../styles";
import LoadingOverlay from "../../components/LoadingOverlay";

gsap.registerPlugin(ScrollTrigger);

const EASE = "cubic-bezier(0.1,0.7,0.5,1)";
/** Pause after Lead/Body word animation before hero image fades in. */
const IMAGE_DELAY_AFTER_TEXT_S = 0.05;

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

function getBlockContent(block) {
  if (!block) return { html: "", plain: "", isRich: false };
  const plain = (block.content?.plain ?? "").trim();
  const htmlFromApi = (block.content?.html ?? "").trim();
  if (hasHtmlTags(plain)) {
    return { html: plain, plain: stripHtml(plain), isRich: true };
  }
  if (plain) {
    return { html: plainToHtml(plain), plain, isRich: false };
  }
  if (htmlFromApi) {
    return { html: htmlFromApi, plain: stripHtml(htmlFromApi), isRich: true };
  }
  return { html: "", plain: "", isRich: false };
}

function getImageUrl(block) {
  if (!block) return null;
  const img = block.image;
  if (img) {
    return img.src ?? img.display?.url ?? img.original?.url ?? img.large?.src ?? null;
  }
  return null;
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
  ${typeHeadingLgLight}
  font-weight: 500;
`;

const BodyText = styled.div`
  ${typeBody}
  line-height: 1.35;
  margin-bottom: 2.5rem;

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
  line-height: 1.45;

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

/** Two balanced columns, `typeSmall`, no list bullets — Collaborators & Donations. */
const PracticeTwoColumnList = styled.div`
  ${typeSmall}
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

  p {
    margin: 0 0 0.35em 0;
    break-inside: avoid;
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
    padding-left: 0;
    break-inside: avoid;
  }

  li:last-child {
    margin-bottom: 0;
  }
`;

const PracticeRowTitle = styled.h2`
  ${typeCaption}
  font-weight: 300;
  margin: 0;
  text-transform: uppercase;
  color: var(--color-muted-light);

  @media ${GRID.MEDIA_MOBILE} {
    font-weight: 400;
  }
`;

const PracticeRowListCell = styled(GridCell)`
  margin-bottom: 2rem;

  @media ${GRID.MEDIA_MOBILE} {
    margin-bottom: 0;
    margin-top: -1.25rem;
  }
`;

// ─── Component ───────────────────────────────────────────

function OurPractice() {
  const [data, setData] = useState(null);
  const refreshKey = useArenaRefresh();

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

        {/* Body */}
        <GridCell
          ref={(el) => { textRefs.current[1] = el; }}
          style={{ opacity: 0 }}
          $start={1}
          $span={6}
          $startTablet={1}
          $spanTablet={6}
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
              <PracticeBodyBlock dangerouslySetInnerHTML={{ __html: data.scope.html }} />
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
              <PracticeRowTitle>Collaborators</PracticeRowTitle>
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

        {/* Donations — same row + two-column list as Collaborators */}
        {data.donations?.plain && (
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
              <PracticeRowTitle>Donations</PracticeRowTitle>
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
              <PracticeTwoColumnList dangerouslySetInnerHTML={{ __html: data.donations.html }} />
            </PracticeRowListCell>
          </>
        )}
      </Grid>
    </Page>}
    </>
  );
}

export default OurPractice;
