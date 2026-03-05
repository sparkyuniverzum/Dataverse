export function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function toIntOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const integer = Math.floor(parsed);
  return integer >= 0 ? integer : null;
}

export function parseSseFrame(rawFrame) {
  const source = String(rawFrame || "").trim();
  if (!source) return null;

  let event = "message";
  let id = null;
  const dataLines = [];

  source.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith(":")) return;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      return;
    }
    if (line.startsWith("id:")) {
      id = line.slice(3).trim() || null;
      return;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  });

  let data = null;
  if (dataLines.length > 0) {
    const payloadText = dataLines.join("\n");
    try {
      data = JSON.parse(payloadText);
    } catch {
      data = { raw: payloadText };
    }
  }

  return { event, id, data };
}

export function drainSseBuffer(buffer, onFrame) {
  let rest = String(buffer || "");
  let separatorIndex = rest.indexOf("\n\n");

  while (separatorIndex >= 0) {
    const rawFrame = rest.slice(0, separatorIndex);
    rest = rest.slice(separatorIndex + 2);
    const parsed = parseSseFrame(rawFrame);
    if (parsed) {
      onFrame(parsed);
    }
    separatorIndex = rest.indexOf("\n\n");
  }

  return rest;
}

export function applySseFrameCursor(frame, previousCursor = 0) {
  const idCursor = toIntOrNull(frame?.id);
  const payloadCursor = toIntOrNull(frame?.data?.last_event_seq);
  const nextCursor = payloadCursor ?? idCursor;
  const base = toIntOrNull(previousCursor) ?? 0;
  if (nextCursor === null) {
    return {
      cursor: base,
      changed: false,
      shouldRefresh: frame?.event === "update",
    };
  }
  const cursor = nextCursor >= base ? nextCursor : base;
  return {
    cursor,
    changed: cursor !== base,
    shouldRefresh: frame?.event === "update",
  };
}
