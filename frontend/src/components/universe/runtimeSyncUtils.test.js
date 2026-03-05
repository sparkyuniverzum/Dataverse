import { describe, expect, it } from "vitest";

import { applySseFrameCursor, drainSseBuffer, parseSseFrame, toIntOrNull } from "./runtimeSyncUtils";

describe("runtimeSyncUtils", () => {
  it("parses SSE frame with event, id and JSON data", () => {
    const frame = parseSseFrame('id: 42\nevent: update\ndata: {"last_event_seq":42,"events_count":1}');
    expect(frame).toEqual({
      id: "42",
      event: "update",
      data: { last_event_seq: 42, events_count: 1 },
    });
  });

  it("drains complete frames and keeps trailing partial frame", () => {
    const incoming =
      'id: 10\nevent: keepalive\ndata: {"last_event_seq":10}\n\n' +
      'id: 11\nevent: update\ndata: {"last_event_seq":11}\n\n' +
      "id: 12\nevent: up";
    const events = [];
    const rest = drainSseBuffer(incoming, (frame) => events.push(frame));

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe("keepalive");
    expect(events[1].event).toBe("update");
    expect(rest).toBe("id: 12\nevent: up");
  });

  it("applies cursor and refresh decision from update frame", () => {
    const frame = { id: "16", event: "update", data: { last_event_seq: 17 } };
    const decision = applySseFrameCursor(frame, 14);
    expect(decision).toEqual({
      cursor: 17,
      changed: true,
      shouldRefresh: true,
    });
  });

  it("keeps cursor on stale frame and does not refresh for keepalive", () => {
    const frame = { id: "9", event: "keepalive", data: { last_event_seq: 9 } };
    const decision = applySseFrameCursor(frame, 12);
    expect(decision).toEqual({
      cursor: 12,
      changed: false,
      shouldRefresh: false,
    });
  });

  it("converts numeric cursor safely", () => {
    expect(toIntOrNull("21")).toBe(21);
    expect(toIntOrNull("-2")).toBeNull();
    expect(toIntOrNull("abc")).toBeNull();
  });

  it("simulates write+SSE convergence sequence", () => {
    const frames = [
      { id: "30", event: "ready", data: { last_event_seq: 30 } },
      { id: "31", event: "update", data: { last_event_seq: 31, events_count: 1 } },
      { id: "31", event: "keepalive", data: { last_event_seq: 31 } },
      { id: "32", event: "update", data: { last_event_seq: 32, events_count: 1 } },
    ];
    let cursor = 0;
    let refreshCount = 0;
    frames.forEach((frame) => {
      const decision = applySseFrameCursor(frame, cursor);
      cursor = decision.cursor;
      if (decision.shouldRefresh) {
        refreshCount += 1;
      }
    });

    expect(cursor).toBe(32);
    expect(refreshCount).toBe(2);
  });
});
