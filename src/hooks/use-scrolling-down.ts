import { useEffect, useState } from "react";

/** Near the top of the page nothing is hidden, so the page start always looks complete. */
const TOP_ZONE = 80;
/** Ignore tiny movements (a finger resting on the screen, momentum jitter). */
const MIN_DELTA = 8;

/** True while the user scrolls the page down; scrolling up, or reaching the top, resets it. */
export function useScrollingDown() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      const y = window.scrollY;
      if (y < TOP_ZONE) {
        setDown(false);
        last = y;
      } else if (Math.abs(y - last) >= MIN_DELTA) {
        setDown(y > last);
        last = y;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return down;
}
