import { useState } from 'react';
import { Disc3 } from 'lucide-react';

interface ArtworkImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ArtworkImage({
  src,
  alt,
  className = '',
  fallbackTitle,
}: ArtworkImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-neutral-200 via-neutral-300 to-neutral-400 dark:from-neutral-800 dark:via-neutral-900 dark:to-black text-neutral-600 dark:text-neutral-300 select-none ${className}`}
        aria-label={alt}
      >
        <Disc3 className="w-7 h-7 opacity-70" />
        {fallbackTitle ? (
          <span className="mt-1 px-2 text-[11px] font-medium truncate max-w-full opacity-80">
            {fallbackTitle}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
