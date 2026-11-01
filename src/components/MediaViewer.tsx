import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import StarRating from './StarRating';

export interface ViewerItem {
  image: string;
  /** Alt text for the image (defaults to the title) */
  alt?: string;
  title?: string;
  subtitle?: string;
  /** 0–5 stars */
  rating?: number;
  ratingLabel?: string;
  details?: Array<{ label: string; value: string }>;
  /** Shown under the image in the photo variant */
  caption?: string;
}

interface MediaViewerProps {
  items: ViewerItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** The thumbnail <img> (or element) for an item: the viewer grows out of
   *  it on open, shrinks back into it on close, and returns focus to it */
  getOrigin?: (index: number) => HTMLElement | null;
  /** detail: image + title/metadata (media grids); photo: large image + caption */
  variant?: 'detail' | 'photo';
  /** Accessible name prefix for the dialog, e.g. "Book details" */
  label?: string;
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const DURATION = 340;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function isOnScreen(rect: DOMRect) {
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

/** Rect of an object-fit: contain image inside its box */
function containRect(box: DOMRect, naturalWidth: number, naturalHeight: number) {
  if (!naturalWidth || !naturalHeight) return box;
  const scale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return new DOMRect(box.left + (box.width - width) / 2, box.top + (box.height - height) / 2, width, height);
}

function imageOf(el: HTMLElement | null): HTMLImageElement | null {
  if (!el) return null;
  return el instanceof HTMLImageElement ? el : el.querySelector('img');
}

/**
 * Shared lightbox / detail view (media grids, game cards, pet photos,
 * project galleries). The image grows out of the clicked thumbnail with a
 * FLIP-style Web Animations clone (cover → contain, so nothing stretches)
 * and shrinks back into it on close; reduced-motion visitors get a short
 * fade. Dialog semantics, focus trap + return, scroll lock, Esc / ← / →,
 * on-screen arrows, swipe left/right to navigate and swipe down to close.
 * Theme styling: .mv-* rules in global.css.
 */
export default function MediaViewer({
  items,
  index,
  onIndexChange,
  onClose,
  getOrigin,
  variant = 'detail',
  label = 'Media viewer',
}: MediaViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const openedFromRef = useRef<HTMLElement | null>(null);
  const [entered, setEntered] = useState(false);
  const [direction, setDirection] = useState<0 | 1 | -1>(0);
  const [dragY, setDragY] = useState(0);
  // If an item's image fails (e.g. a game cover that fell back to another
  // URL in its tile), show whatever the thumbnail actually loaded
  const [failed, setFailed] = useState<Record<number, string>>({});
  // Image aspect ratios (width / height): landscape art (game headers) gets
  // a stacked layout instead of a tall frame with empty space around it.
  // The opening item's comes from its thumbnail, so the first frame is right.
  const [aspects, setAspects] = useState<Record<number, number>>(() => {
    const img = imageOf(getOrigin?.(index) ?? null);
    return img?.naturalWidth ? { [index]: img.naturalWidth / img.naturalHeight } : {};
  });

  const item = items[index];
  const aspect = aspects[index];
  const wide = variant === 'detail' && aspect !== undefined && aspect > 1.15;
  const count = items.length;
  const go = useCallback(
    (delta: 1 | -1) => {
      if (count < 2 || closingRef.current) return;
      setDirection(delta);
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  // Clone of the image used for the grow/shrink animation
  const flyClone = useCallback((src: string, from: DOMRect, to: DOMRect, fromRadius: string, toRadius: string) => {
    const clone = document.createElement('img');
    clone.src = src;
    clone.alt = '';
    clone.className = 'mv-fly';
    Object.assign(clone.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    document.body.appendChild(clone);
    const anim = clone.animate(
      [
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: fromRadius },
        { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: toRadius },
      ],
      { duration: DURATION, easing: EASE, fill: 'forwards' },
    );
    return { clone, anim };
  }, []);

  // Open: lock scroll, move focus in, grow from the thumbnail
  useLayoutEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPadding = html.style.paddingRight;
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;

    const origin = getOrigin?.(index) ?? null;
    openedFromRef.current = (document.activeElement as HTMLElement | null) ?? origin;
    closeRef.current?.focus({ preventScroll: true });

    const reduce = prefersReducedMotion();
    const fade = (el: HTMLElement | null, duration: number) =>
      el?.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });

    fade(backdropRef.current, reduce ? 120 : 260);
    const originImg = imageOf(origin);
    const originRect = originImg?.getBoundingClientRect();
    // The viewer's <img> fills the frame's content box (object-fit: contain)
    const box = imgRef.current?.getBoundingClientRect();
    if (!reduce && originImg && originRect && isOnScreen(originRect) && originImg.naturalWidth && box) {
      const target = containRect(box, originImg.naturalWidth, originImg.naturalHeight);
      const { clone, anim } = flyClone(originImg.currentSrc || item.image, originRect, target, getComputedStyle(originImg).borderRadius || '8px', '6px');
      if (imgRef.current) imgRef.current.style.opacity = '0';
      panelRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION, easing: 'ease-out', delay: 80, fill: 'backwards' });
      anim.finished
        .catch(() => undefined)
        .then(() => {
          if (imgRef.current) imgRef.current.style.opacity = '';
          clone.remove();
          setEntered(true);
        });
    } else {
      panelRef.current?.animate(
        reduce ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
        { duration: reduce ? 120 : 240, easing: EASE },
      );
      setEntered(true);
    }

    return () => {
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPadding;
    };
    // Mount-only: later index changes are navigation, not opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close: shrink back into the (current) item's thumbnail, then unmount
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const origin = getOrigin?.(index) ?? null;
    const originImg = imageOf(origin);
    origin?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const originRect = originImg?.getBoundingClientRect();
    const reduce = prefersReducedMotion();
    const img = imgRef.current;

    const finish = () => {
      onClose();
      const focusTarget = (origin?.closest('button, a, [tabindex]') as HTMLElement | null) ?? openedFromRef.current;
      focusTarget?.focus?.({ preventScroll: true });
    };

    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce ? 120 : 260, easing: 'ease-in', fill: 'forwards' });
    if (!reduce && img && img.complete && img.naturalWidth && originRect && isOnScreen(originRect)) {
      const from = containRect(img.getBoundingClientRect(), img.naturalWidth, img.naturalHeight);
      const { clone, anim } = flyClone(img.currentSrc || item.image, from, originRect, '6px', getComputedStyle(originImg!).borderRadius || '8px');
      img.style.opacity = '0';
      panelRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
      anim.finished
        .catch(() => undefined)
        .then(() => {
          finish();
          // Let the thumbnail paint before the clone disappears (no flicker)
          requestAnimationFrame(() => clone.remove());
        });
    } else {
      const anim = panelRef.current?.animate(
        reduce ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }],
        { duration: reduce ? 120 : 200, easing: 'ease-in', fill: 'forwards' },
      );
      if (anim) anim.finished.catch(() => undefined).then(finish);
      else finish();
    }
  }, [flyClone, getOrigin, index, item.image, onClose]);

  // Keyboard: Esc, arrows, focus trap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowLeft') {
        go(-1);
      } else if (e.key === 'ArrowRight') {
        go(1);
      } else if (e.key === 'Tab') {
        const focusable = rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]');
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !rootRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !rootRef.current?.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, go]);

  // Touch: swipe left/right to navigate, swipe down (from the top) to close
  const touch = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, scrollTop: panelRef.current?.scrollTop ?? 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.touches[0];
    const dy = t.clientY - touch.current.y;
    const dx = t.clientX - touch.current.x;
    if (touch.current.scrollTop <= 0 && dy > 0 && Math.abs(dy) > Math.abs(dx)) setDragY(dy);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (start.scrollTop <= 0 && dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      close();
    } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(dx < 0 ? 1 : -1);
    }
    setDragY(0);
  };

  if (typeof document === 'undefined' || !item) return null;

  const title = item.title ?? item.alt ?? '';
  const hasRating = item.rating !== undefined && item.rating > 0;
  const dialogLabel = `${label}: ${title || `${index + 1} of ${count}`}`;

  return createPortal(
    <div
      ref={rootRef}
      className={`mv-root mv-root--${variant}${wide ? ' mv-root--wide' : ''}`}
      style={wide ? ({ '--mv-aspect': String(aspect) } as React.CSSProperties) : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      data-entered={entered ? '' : undefined}
    >
      <div ref={backdropRef} className="mv-backdrop" onClick={close} />

      <div
        ref={panelRef}
        className={`mv-panel mv-panel--${variant}${wide ? ' mv-panel--wide' : ''}`}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          // Clicks on the photo variant's empty space close it, like the backdrop
          if (variant === 'photo' && e.target === e.currentTarget) close();
        }}
      >
        <div ref={frameRef} className="mv-frame">
          <img
            key={index}
            ref={imgRef}
            src={failed[index] ?? item.image}
            alt={item.alt ?? title}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w && h && aspects[index] !== w / h) setAspects((a) => ({ ...a, [index]: w / h }));
            }}
            onError={() => {
              const loaded = imageOf(getOrigin?.(index) ?? null)?.currentSrc;
              if (loaded && loaded !== (failed[index] ?? item.image)) setFailed((f) => ({ ...f, [index]: loaded }));
            }}
            className={`mv-image${direction ? ` mv-image--from-${direction > 0 ? 'right' : 'left'}` : ''}`}
            draggable={false}
          />
        </div>

        {variant === 'detail' ? (
          <div className="mv-info" key={`info-${index}`}>
            {count > 1 && (
              <p className="mv-count">
                {index + 1} / {count}
              </p>
            )}
            <h2 className="mv-title">{title}</h2>
            {item.subtitle && <p className="mv-subtitle">{item.subtitle}</p>}
            {hasRating && <StarRating rating={item.rating!} label={item.ratingLabel} className="mv-rating" />}
            {item.details && item.details.length > 0 && (
              <dl className="mv-details">
                {item.details.map((d) => (
                  <div key={d.label} className="mv-detail">
                    <dt>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : (
          (item.caption || count > 1) && (
            <div className="mv-caption">
              {item.caption && <p>{item.caption}</p>}
              {count > 1 && (
                <span className="mv-count">
                  {index + 1} / {count}
                </span>
              )}
            </div>
          )
        )}
      </div>

      <button ref={closeRef} type="button" className="mv-btn mv-close" onClick={close} aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {count > 1 && (
        <>
          <button type="button" className="mv-btn mv-nav mv-prev" onClick={() => go(-1)} aria-label="Previous">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button type="button" className="mv-btn mv-nav mv-next" onClick={() => go(1)} aria-label="Next">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
