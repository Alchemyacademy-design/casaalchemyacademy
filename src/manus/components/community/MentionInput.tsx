import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { handleFromProfile, searchMembers, type MentionCandidate } from "./mentions";
import { initialsFrom, resolveAvatarUrl } from "@/manus/components/UserAvatar";

type Props = {
  value: string;
  onChange: (next: string, directoryPatch: Map<string, string>) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  ariaLabel?: string;
};

export type MentionInputHandle = { focus: () => void };

// Simple @-picker that overlays suggestions when the caret is inside a
// `@token` prefix. When the user commits, we replace the token with the
// canonical @handle and hand the caller a directory entry mapping the
// handle back to the user's id, so mention notifications can be dispatched.
const MentionInput = forwardRef<MentionInputHandle, Props>(function MentionInput(
  { value, onChange, placeholder, rows = 3, maxLength, ariaLabel },
  ref,
) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MentionCandidate[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const tokenStart = useRef<number>(-1);

  useImperativeHandle(ref, () => ({ focus: () => areaRef.current?.focus() }), []);

  useEffect(() => {
    if (query === null) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const rows = await searchMembers(query);
        if (!cancelled) { setResults(rows); setHighlight(0); }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [query]);

  const detectToken = useCallback((text: string, caret: number) => {
    // walk back from caret until whitespace or @
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(text[i]) && text[i] !== "@") i--;
    if (i < 0 || text[i] !== "@") { tokenStart.current = -1; setQuery(null); return; }
    // must be start of text or after whitespace
    if (i > 0 && !/\s/.test(text[i - 1])) { tokenStart.current = -1; setQuery(null); return; }
    const term = text.slice(i + 1, caret);
    if (!/^[a-zA-Z0-9_.-]{0,40}$/.test(term)) { tokenStart.current = -1; setQuery(null); return; }
    tokenStart.current = i;
    setQuery(term);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next, new Map());
    detectToken(next, e.target.selectionStart ?? next.length);
  };

  const insertMention = (candidate: MentionCandidate) => {
    const area = areaRef.current;
    if (!area || tokenStart.current < 0) return;
    const handle = handleFromProfile(candidate);
    const before = value.slice(0, tokenStart.current);
    const after = value.slice(area.selectionStart ?? value.length);
    const insertion = `@${handle} `;
    const next = `${before}${insertion}${after}`;
    const dir = new Map<string, string>([[handle.toLowerCase(), candidate.id]]);
    onChange(next, dir);
    setQuery(null);
    tokenStart.current = -1;
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      area.focus();
      area.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query === null || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + results.length) % results.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(results[highlight]); }
    else if (e.key === "Escape") { setQuery(null); }
  };

  const showPopover = query !== null && (loading || results.length > 0);

  const popover = useMemo(() => {
    if (!showPopover) return null;
    return (
      <div
        role="listbox"
        aria-label="Mention suggestions"
        style={{
          position: "absolute", bottom: "100%", left: 0, marginBottom: 6,
          minWidth: 260, maxWidth: 320, background: "var(--aa-surface, #fff)",
          border: "1px solid var(--aa-cream-dark, #e6e2d8)", borderRadius: 10,
          boxShadow: "0 12px 30px rgba(20,25,15,.12)", padding: 6, zIndex: 40,
          maxHeight: 260, overflowY: "auto",
        }}
      >
        {loading && <div style={{ padding: "6px 8px", fontSize: 12, opacity: 0.7 }}>Searching…</div>}
        {!loading && results.length === 0 && (
          <div style={{ padding: "6px 8px", fontSize: 12, opacity: 0.7 }}>No members found</div>
        )}
        {results.map((r, i) => {
          const name = r.display_name || r.full_name || "Academy member";
          const url = resolveAvatarUrl(r.avatar_path);
          return (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); insertMention(r); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px", borderRadius: 8, textAlign: "left",
                background: i === highlight ? "rgba(196,160,90,.14)" : "transparent",
                border: "none", cursor: "pointer",
              }}
            >
              {url ? (
                <img src={url} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--aa-cream-dark, #e6e2d8)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                  {initialsFrom(name)}
                </span>
              )}
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                <strong style={{ fontSize: 12 }}>{name}</strong>
                <span style={{ fontSize: 10, opacity: 0.65 }}>@{handleFromProfile(r)}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }, [showPopover, loading, results, highlight]);

  return (
    <div style={{ position: "relative" }}>
      <Textarea
        ref={areaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-label={ariaLabel}
      />
      {popover}
    </div>
  );
});

export default MentionInput;