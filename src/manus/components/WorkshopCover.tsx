import { useState } from "react";
import { resolveAssetUrl } from "@/manus/lib/asset-url";

/** Workshop artwork is always displayed in full at its natural proportions. */
export default function WorkshopCover({ src, alt, className = "", loading }: {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const url = resolveAssetUrl(src);
  return <CoverImage key={url} url={url} alt={alt} className={className} loading={loading} />;
}

function CoverImage({ url, alt, className, loading }: {
  url: string | null;
  alt: string;
  className: string;
  loading?: "lazy" | "eager";
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`w-full bg-[var(--aa-cream-dark)] ${loaded && !failed ? "" : "min-h-32"} ${className}`}>
      {url && !failed && (
        <img
          src={url}
          alt={alt}
          loading={loading}
          className="block h-auto w-full object-contain"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}