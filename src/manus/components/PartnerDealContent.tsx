import { resolveAssetUrl } from "@/manus/lib/asset-url";
import type { ReactNode } from "react";

export function PartnerDealCover({ src, title }: {
  src?: string | null;
  title: string;
}) {
  const cover = resolveAssetUrl(src);
  return (
    <div className={`relative bg-[var(--aa-white)] p-5 ${cover ? "" : "min-h-32"}`}>
      {cover && <img src={cover} alt={title} className="block h-auto w-full object-contain" />}
    </div>
  );
}

export function PartnerDealDescription({ text }: { text: string }) {
  // Keep the exact displayed text while making Australian mobile numbers callable.
  const mobile = /(?<!\d)(?:04\d{2}[ \t]?\d{3}[ \t]?\d{3}|\+61[ \t]?4\d{2}[ \t]?\d{3}[ \t]?\d{3})(?!\d)/g;
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(mobile)) {
    const index = match.index ?? 0;
    parts.push(text.slice(offset, index));
    parts.push(<a key={index} href={`tel:${match[0].replace(/\s/g, "")}`} className="whitespace-nowrap underline">{match[0]}</a>);
    offset = index + match[0].length;
  }
  parts.push(text.slice(offset));
  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}