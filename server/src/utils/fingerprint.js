import { createHash } from 'crypto';

// ── Normalization regexes (applied in order) ─────────────────────────────────

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX_0X_RE = /\b0x[0-9a-f]+\b/gi;
// 8+ hex chars that contain at least one digit — avoids erasing ordinary words
// like "added", "dead", "facade", etc.
const HEX_LONG_RE = /\b(?=[0-9a-f]*[0-9])[0-9a-f]{8,}\b/gi;
// line:col removed BEFORE standalone integers so "42:13" is fully removed,
// not left as a bare ":"
const LINE_COL_RE = /\b\d+:\d+\b/g;
const INTEGER_RE = /\b\d+\b/g;
const WS_RE = /\s+/g;

/**
 * Normalize an error message by stripping volatile tokens (IDs, hex, numbers,
 * line:col refs) and collapsing whitespace.
 *
 * Exported so ingestService can reuse it for title derivation.
 */
export function normalizeMessage(raw) {
  let msg = raw || '';
  msg = msg.replace(UUID_RE, '');
  msg = msg.replace(HEX_0X_RE, '');
  msg = msg.replace(HEX_LONG_RE, '');
  msg = msg.replace(LINE_COL_RE, '');
  msg = msg.replace(INTEGER_RE, '');
  return msg.trim().replace(WS_RE, ' ');
}

/**
 * Extract the file basename, handling both Unix (/) and Windows (\) separators.
 */
function fileBasename(filePath) {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

/**
 * Normalise a function name: treat <anonymous> variants as "anonymous",
 * strip "Object." prefix that V8 adds for module-level calls.
 */
function cleanFunc(name) {
  if (!name || name === '<anonymous>' || name === 'Object.<anonymous>') {
    return 'anonymous';
  }
  return name.replace(/^Object\./, '');
}

/**
 * Parse the first recognisable stack frame from a raw stack trace and return
 * "function@basename" (basename only — no directory path, no line:col numbers).
 *
 * Using basename only means the same bug on different machines (with different
 * absolute paths) yields the same fingerprint.
 *
 * Returns "anonymous" when the stack is absent, empty, or unparseable.
 */
function parseTopFrame(rawStack) {
  if (!rawStack) return 'anonymous';

  for (const line of rawStack.split('\n')) {
    const t = line.trim();
    if (!t) continue;

    // V8 with function: "at funcName (/path/to/file.js:42:13)"
    let m = t.match(/^at\s+(.+?)\s+\((.+?)(?::\d+(?::\d+)?)?\)$/);
    if (m) {
      return `${cleanFunc(m[1])}@${fileBasename(m[2])}`;
    }

    // V8 anonymous: "at /path/to/file.js:42:13"  (no parens, no function name)
    m = t.match(/^at\s+([^(]+?)(?::\d+(?::\d+)?)?$/);
    if (m && m[1].trim()) {
      return `anonymous@${fileBasename(m[1].trim())}`;
    }

    // Firefox / Safari: "funcName@/path/to/file.js:42:13"
    m = t.match(/^(.+?)@(.+?)(?::\d+(?::\d+)?)?$/);
    if (m && m[2]) {
      return `${m[1] || 'anonymous'}@${fileBasename(m[2])}`;
    }
  }

  return 'anonymous';
}

/**
 * Compute a 16-hex-char fingerprint for an error.
 *
 * Pure function — no I/O, no side effects, fully deterministic.
 *
 * Canonical input: "{normalizedMessage}|{errorType}|{topFrame}"
 * Hash: SHA-1, first 16 hex chars.
 *
 * @param {string} rawMessage  The error message
 * @param {string} [errorType] e.g. "TypeError"; defaults to "UnknownError"
 * @param {string} [rawStack]  Stack trace string
 * @returns {string} 16 lowercase hex characters
 */
export function fingerprint(rawMessage, errorType, rawStack) {
  const type = errorType || 'UnknownError';
  const topFrame = parseTopFrame(rawStack);
  const normalizedMsg = normalizeMessage(rawMessage);
  const canonical = `${normalizedMsg}|${type}|${topFrame}`;
  return createHash('sha1').update(canonical, 'utf8').digest('hex').slice(0, 16);
}
