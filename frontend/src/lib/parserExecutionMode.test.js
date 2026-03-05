import { describe, expect, it } from "vitest";

import { resolveParserExecutionMode } from "./parserExecutionMode";

describe("parser execution mode", () => {
  it("defaults all parser-only flags to false", () => {
    expect(resolveParserExecutionMode({})).toEqual({
      link: false,
      ingest: false,
      extinguish: false,
    });
  });

  it("parses truthy and falsy env values", () => {
    expect(
      resolveParserExecutionMode({
        VITE_PARSER_ONLY_LINK: "true",
        VITE_PARSER_ONLY_INGEST: "0",
        VITE_PARSER_ONLY_EXTINGUISH: "YES",
      })
    ).toEqual({
      link: true,
      ingest: false,
      extinguish: true,
    });
  });
});

