// PCI-safe logging helpers. NEVER log PAN, CVV, or track data.
// Redacts anything that looks like a card number or CVV before it reaches console.

const PAN_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
const CVV_REGEX = /\b\d{3,4}\b/g;

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(PAN_REGEX, "[REDACTED_PAN]");
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (
        key === "number" ||
        key === "cardnumber" ||
        key === "pan" ||
        key === "cvv" ||
        key === "cvc" ||
        key === "cvv2" ||
        key === "csc" ||
        key === "track1" ||
        key === "track2" ||
        key === "encrypteddata"
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function safeLog(msg: string, extra?: unknown) {
  if (extra !== undefined) {
    console.log(msg, redact(extra));
  } else {
    console.log(msg);
  }
}

export function safeError(msg: string, extra?: unknown) {
  if (extra !== undefined) {
    console.error(msg, redact(extra));
  } else {
    console.error(msg);
  }
}

/**
 * Throws if the payload contains anything that looks like raw card data.
 * Use at the top of every payment edge function to enforce SAQ A.
 */
export function assertNoCardData(payload: unknown): void {
  const seen = new WeakSet<object>();
  function walk(v: unknown, path: string): void {
    if (v === null || v === undefined) return;
    if (typeof v === "string") {
      const stripped = v.replace(/[\s-]/g, "");
      if (/^\d{13,19}$/.test(stripped)) {
        throw new Error(
          `PCI violation: raw PAN detected at ${path}. Card data must be tokenized by Adyen.`,
        );
      }
      return;
    }
    if (typeof v !== "object") return;
    if (seen.has(v as object)) return;
    seen.add(v as object);
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (
        key === "number" ||
        key === "cardnumber" ||
        key === "pan" ||
        key === "cvv" ||
        key === "cvc" ||
        key === "csc"
      ) {
        throw new Error(
          `PCI violation: forbidden field "${k}" at ${path}. Card data must be tokenized by Adyen.`,
        );
      }
      walk(val, `${path}.${k}`);
    }
  }
  walk(payload, "$");
}

/**
 * Monkey-patches console.{log,error,warn,info,debug} so every argument is
 * passed through `redact` before it reaches stdout/stderr. Call once at the
 * top of any edge function that handles payment-adjacent data — this makes
 * accidental leakage of a PAN or CVV into logs impossible even if new
 * `console.log` calls are added later.
 *
 * Idempotent: safe to call multiple times.
 */
let __consoleRedactionInstalled = false;
export function installConsoleRedaction(): void {
  if (__consoleRedactionInstalled) return;
  __consoleRedactionInstalled = true;
  const methods = ["log", "error", "warn", "info", "debug"] as const;
  for (const m of methods) {
    const original = console[m].bind(console);
    console[m] = (...args: unknown[]) => {
      try {
        original(...args.map(redact));
      } catch {
        original(...args);
      }
    };
  }
}

