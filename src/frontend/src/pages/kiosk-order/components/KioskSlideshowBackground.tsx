import { useCallback, useEffect, useRef, useState } from "react";

const SLIDE_INTERVAL_MS = 15_000;
const UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920&q=80",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80",
];

export default function KioskSlideshowBackground({
  paused,
}: { paused: boolean }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setCurrentIdx((prev) => (prev + 1) % UNSPLASH_IMAGES.length);
      setFading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    if (paused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(advance, SLIDE_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [paused, advance]);

  const nextIdx = (currentIdx + 1) % UNSPLASH_IMAGES.length;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={UNSPLASH_IMAGES[currentIdx]}
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          fading ? "opacity-0" : "opacity-100"
        }`}
      />
      <img
        src={UNSPLASH_IMAGES[nextIdx]}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-0"
      />
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)" }}
      />
    </div>
  );
}
