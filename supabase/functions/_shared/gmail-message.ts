// Shared helper for building an RFC 2822 message to send through the Gmail
// API's `raw` field via the Lovable connector gateway.
//
// Fixes two encoding bugs previously duplicated across capture-lead,
// welcome-email, and send-registration-confirmation:
//
// 1. Headers (Subject, From, To) with non-ASCII characters — em dash, curly
//    quotes, accented letters — were inserted raw. RFC 5322 headers must be
//    ASCII; non-ASCII must be MIME-encoded per RFC 2047. We encode any such
//    header as a base64 UTF-8 encoded-word (`=?UTF-8?B?...?=`). Display names
//    in address headers are encoded separately so the `<addr-spec>` stays
//    parseable.
//
// 2. Body parts declared `Content-Transfer-Encoding: 7bit` while carrying raw
//    UTF-8 (multi-byte, 8-bit) content. We now emit `quoted-printable` and
//    encode the bodies accordingly, per RFC 2045.

const CRLF = "\r\n";

const NON_ASCII_RE = /[^\x00-\x7F]/;

function hasNonAscii(s: string): boolean {
  return NON_ASCII_RE.test(s);
}

function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** RFC 2047 encoded-word (base64) for a full header value. */
function encodeWord(s: string): string {
  return `=?UTF-8?B?${base64Utf8(s)}?=`;
}

/**
 * Encode an address-header value. Accepts either a bare email
 * (`user@example.com`) or a display-name form (`Name <user@example.com>` or
 * `"Name" <user@example.com>`). Only the display-name portion is MIME-encoded;
 * the addr-spec must remain ASCII and unquoted so relays can parse it.
 */
export function encodeAddressHeader(value: string): string {
  const trimmed = value.trim();
  const m = trimmed.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!m) {
    // Bare address — must be ASCII per spec; return as-is.
    return trimmed;
  }
  let name = m[1].trim();
  const addr = m[2].trim();
  // Strip surrounding quotes if present; encoded-word doesn't need them.
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  if (!name) return addr;
  const encodedName = hasNonAscii(name) ? encodeWord(name) : `"${name.replace(/"/g, '\\"')}"`;
  return `${encodedName} <${addr}>`;
}

/** Encode any header value; wraps in an encoded-word only when needed. */
export function encodeHeaderValue(value: string): string {
  return hasNonAscii(value) ? encodeWord(value) : value;
}

/**
 * Quoted-printable encoding per RFC 2045. Encodes:
 * - all non-printable / non-ASCII bytes as `=XX`
 * - `=` itself
 * - trailing whitespace on a line
 * Soft-wraps lines to <= 76 chars using `=` line continuations.
 */
export function quotedPrintableEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  // First, encode bytes -> a stream of characters (each either 1 literal char
 // or a 3-char `=XX` escape), preserving CRLF line breaks as hard breaks.
  const tokens: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Hard line break (CRLF or lone LF) — emit as CRLF, don't encode.
    if (b === 0x0d && bytes[i + 1] === 0x0a) {
      tokens.push("\r\n");
      i++;
      continue;
    }
    if (b === 0x0a) {
      tokens.push("\r\n");
      continue;
    }
    // Printable ASCII except '=' -> literal.
    if (b === 0x09 || (b >= 0x20 && b <= 0x7e && b !== 0x3d)) {
      tokens.push(String.fromCharCode(b));
    } else {
      tokens.push("=" + b.toString(16).toUpperCase().padStart(2, "0"));
    }
  }

  // Second pass: enforce max line length (76) with soft breaks, and escape
  // trailing whitespace before hard breaks.
  const outLines: string[] = [];
  let line = "";
  const flushLine = () => {
    // Escape trailing SP/TAB by turning the last char into =XX.
    if (line.length > 0) {
      const last = line[line.length - 1];
      if (last === " " || last === "\t") {
        const code = last.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
        line = line.slice(0, -1) + "=" + code;
      }
    }
    outLines.push(line);
    line = "";
  };
  for (const tok of tokens) {
    if (tok === "\r\n") { flushLine(); continue; }
    // Ensure we can add tok without exceeding 76 chars (leave room for '=' soft break).
    if (line.length + tok.length > 75) {
      outLines.push(line + "=");
      line = "";
    }
    line += tok;
  }
  if (line.length > 0) flushLine();
  return outLines.join("\r\n");
}

export interface BuildRawMessageArgs {
  from: string;
  to: string;
  subject: string;
  html: string;
  plaintext: string;
  /** Optional extra headers (Reply-To, Cc, Bcc, etc.). Values are encoded automatically. */
  headers?: Record<string, string>;
}

/**
 * Build the base64url-encoded RFC 2822 message expected by the Gmail API's
 * `messages.send` `raw` field. Handles MIME-encoding of headers and
 * quoted-printable encoding of the multipart/alternative body parts so that
 * non-ASCII content (em dashes, accented characters, curly quotes, middle
 * dots) renders correctly in the recipient's inbox.
 */
export function buildGmailRawMessage(args: BuildRawMessageArgs): string {
  const boundary = `casa_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers: [string, string][] = [
    ["From", encodeAddressHeader(args.from)],
    ["To", encodeAddressHeader(args.to)],
    ["Subject", encodeHeaderValue(args.subject)],
    ["MIME-Version", "1.0"],
    ["Content-Type", `multipart/alternative; boundary="${boundary}"`],
  ];
  for (const [k, v] of Object.entries(args.headers ?? {})) {
    headers.push([k, /^(from|to|cc|bcc|reply-to)$/i.test(k) ? encodeAddressHeader(v) : encodeHeaderValue(v)]);
  }

  const plainPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    quotedPrintableEncode(args.plaintext),
  ].join(CRLF);

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    quotedPrintableEncode(args.html),
  ].join(CRLF);

  const rfc2822 =
    headers.map(([k, v]) => `${k}: ${v}`).join(CRLF) +
    CRLF + CRLF +
    plainPart + CRLF +
    htmlPart + CRLF +
    `--${boundary}--` + CRLF;

  // base64url — standard base64 with URL-safe chars and no padding.
  const bytes = new TextEncoder().encode(rfc2822);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}