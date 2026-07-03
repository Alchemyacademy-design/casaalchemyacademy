import { Fragment } from "react";
import { MENTION_TOKEN_RE } from "./mentions";

// Renders body text with @handle tokens as highlighted chips. Preserves
// line breaks so post/reply bodies keep their original layout.
export default function MentionText({ text }: { text: string }) {
  if (!text) return null;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const matches = [...text.matchAll(MENTION_TOKEN_RE)];
  matches.forEach((m, idx) => {
    const start = m.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <span
        key={`m-${idx}-${start}`}
        style={{
          background: "rgba(196,160,90,.18)",
          color: "var(--aa-text-dark, inherit)",
          padding: "0 4px",
          borderRadius: 4,
          fontWeight: 600,
        }}
      >
        @{m[1]}
      </span>,
    );
    cursor = start + m[0].length;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return (
    <Fragment>
      {nodes.map((n, i) => (typeof n === "string" ? <Fragment key={i}>{n}</Fragment> : n))}
    </Fragment>
  );
}