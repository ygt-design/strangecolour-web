import { useState, useCallback, useRef } from "react";
import styled from "styled-components";
import { typeSmallMixed } from "../styles";
import { GRID } from "../grid/config.js";

const ALIGN_TO_JUSTIFY = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

const Wrapper = styled.article`
  display: flex;
  flex-direction: column;
  gap: 0rem;
  height: 100%;
  justify-content: ${(p) => ALIGN_TO_JUSTIFY[p.$align] ?? "flex-start"};

  &:hover .caption {
    opacity: 1;
  }

  @media ${GRID.MEDIA_MOBILE} {
    .caption {
      opacity: 1;
    }
  }
`;

const ImageWrap = styled.div`
  position: relative;
  overflow: hidden;
  user-select: none;
`;

const Sizer = styled.img`
  display: block;
  width: 100%;
  height: auto;
  visibility: hidden;
`;

const FadeThumb = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: ${(p) => (p.$active ? 1 : 0)};
  transition: opacity 0.45s ease;
  pointer-events: none;
`;

const Thumb = styled.img`
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
`;

const Title = styled.div`
  ${typeSmallMixed}
  margin-top: ${(p) => p.$captionGap ?? "0.25rem"};
  font-weight: ${(p) => p.$titleWeight ?? 400} !important;
  opacity: 0;
  transition: opacity 0.2s ease;

  p {
    margin: 0;
  }
`;

const Subtitle = styled.div`
  ${typeSmallMixed}
  opacity: 0;
  transition: opacity 0.2s ease;

  p {
    margin: 0;
  }
`;

function ThumbnailItem({
  title,
  thumbnailUrl,
  images,
  subtitleHtml,
  align,
  captionGap,
  titleWeight,
}) {
  const hasCarousel = images && images.length > 1;
  const [index, setIndex] = useState(0);
  const [cursor, setCursor] = useState("default");
  const wrapRef = useRef(null);

  const handleMouseMove = useCallback(
    (e) => {
      if (!hasCarousel) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setCursor(x < rect.width / 2 ? "left" : "right");
    },
    [hasCarousel]
  );

  const handleMouseLeave = useCallback(() => {
    setCursor("default");
  }, []);

  const handleClick = useCallback(
    (e) => {
      if (!hasCarousel) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const isLeft = x < rect.width / 2;
      setIndex((prev) =>
        isLeft
          ? (prev - 1 + images.length) % images.length
          : (prev + 1) % images.length
      );
    },
    [hasCarousel, images]
  );

  const displayUrl = hasCarousel ? images[index] : thumbnailUrl;
  const hasContent = displayUrl || title || subtitleHtml;
  if (!hasContent) return null;

  const cursorStyle =
    cursor === "left"
      ? "w-resize"
      : cursor === "right"
        ? "e-resize"
        : "default";

  return (
    <Wrapper $align={align}>
      {hasCarousel ? (
        <ImageWrap
          ref={wrapRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ cursor: cursorStyle }}
        >
          <Sizer src={images[index]} alt="" draggable={false} />
          {images.map((url, i) => (
            <FadeThumb
              key={url}
              src={url}
              alt=""
              $active={i === index}
              draggable={false}
            />
          ))}
        </ImageWrap>
      ) : (
        displayUrl && <Thumb src={displayUrl} alt="" />
      )}
      {title && (
        <Title
          className="caption"
          $captionGap={captionGap}
          $titleWeight={titleWeight}
        >
          {title}
        </Title>
      )}
      {subtitleHtml && (
        <Subtitle className="caption" dangerouslySetInnerHTML={{ __html: subtitleHtml }} />
      )}
    </Wrapper>
  );
}

export default ThumbnailItem;
