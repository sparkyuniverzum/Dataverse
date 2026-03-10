import { describe, expect, it } from "vitest";

import {
  createParserTelemetrySnapshot,
  EMPTY_PARSER_TELEMETRY,
  recordParserTelemetry,
} from "./parserExecutionTelemetry";

describe("parser execution telemetry", () => {
  it("normalizes invalid source payload", () => {
    const normalized = createParserTelemetrySnapshot({
      attempts: -1,
      parser_success: "4",
      by_action: { link: "2", ingest: null, extinguish: "x" },
      last_error: "  parser crashed  ",
      last_error_at: 5,
    });
    expect(normalized).toEqual({
      attempts: 0,
      parser_success: 4,
      parser_failed: 0,
      fallback_used: 0,
      fallback_success: 0,
      fallback_failed: 0,
      by_action: {
        link: 2,
        ingest: 0,
        extinguish: 0,
        other: 0,
      },
      by_route_family: {
        canonical: 0,
        alias: 0,
        parser: 0,
        unknown: 0,
      },
      last_error: "parser crashed",
      last_error_at: null,
    });
  });

  it("counts parser success by action", () => {
    const next = recordParserTelemetry(EMPTY_PARSER_TELEMETRY, {
      action: "link",
      parserOk: true,
      routeFamily: "parser",
    });
    expect(next.attempts).toBe(1);
    expect(next.parser_success).toBe(1);
    expect(next.parser_failed).toBe(0);
    expect(next.by_action.link).toBe(1);
    expect(next.by_route_family.parser).toBe(1);
  });

  it("counts parser failure and fallback result", () => {
    const failed = recordParserTelemetry(EMPTY_PARSER_TELEMETRY, {
      action: "ingest",
      parserOk: false,
      parserError: new Error("not supported"),
      fallbackUsed: true,
      fallbackOk: true,
      routeFamily: "alias",
    });
    expect(failed.attempts).toBe(1);
    expect(failed.parser_failed).toBe(1);
    expect(failed.fallback_used).toBe(1);
    expect(failed.fallback_success).toBe(1);
    expect(failed.fallback_failed).toBe(0);
    expect(failed.by_action.ingest).toBe(1);
    expect(failed.by_route_family.alias).toBe(1);
    expect(failed.last_error).toBe("not supported");
    expect(failed.last_error_at).toMatch(/T/);
  });
});
