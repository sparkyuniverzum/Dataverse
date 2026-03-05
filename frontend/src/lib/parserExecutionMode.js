function parseBooleanFlag(raw, fallback = false) {
  if (typeof raw !== "string") return Boolean(fallback);
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return Boolean(fallback);
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return Boolean(fallback);
}

export function resolveParserExecutionMode(env = import.meta.env || {}) {
  const mode = String(env.MODE || "")
    .trim()
    .toLowerCase();
  const stagingDefaults =
    mode === "staging"
      ? {
          link: true,
          ingest: false,
          extinguish: false,
        }
      : {
          link: false,
          ingest: false,
          extinguish: false,
        };

  return Object.freeze({
    link: parseBooleanFlag(env.VITE_PARSER_ONLY_LINK, stagingDefaults.link),
    ingest: parseBooleanFlag(env.VITE_PARSER_ONLY_INGEST, stagingDefaults.ingest),
    extinguish: parseBooleanFlag(env.VITE_PARSER_ONLY_EXTINGUISH, stagingDefaults.extinguish),
  });
}

export const PARSER_EXECUTION_MODE = resolveParserExecutionMode();
