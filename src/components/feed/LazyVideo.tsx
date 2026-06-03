import { useEffect, useRef, useState } from 'react';

export default function LazyVideo({
  src,
  className,
  controls = true,
  muted = false,
  poster,
  fit = 'contain',
}: {
  src: string;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  poster?: string;
  fit?: 'contain' | 'cover';
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [canLoad, setCanLoad] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || canLoad) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCanLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '360px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoad]);

  return (
    <div ref={rootRef} className={`relative h-full w-full ${className || ''}`}>
      {canLoad ? (
        <video src={src} controls={controls} muted={muted} preload="metadata" poster={poster} className={`h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`} />
      ) : (
        <button
          type="button"
          onClick={() => setCanLoad(true)}
          className="flex h-full w-full items-center justify-center bg-black text-white"
        >
          {poster ? <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-[#1877f2] shadow-xl">
            <i className="fa-solid fa-play"></i>
          </span>
        </button>
      )}
    </div>
  );
}
