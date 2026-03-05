import { describe, expect, it } from "vitest";

import { mergeMetadataValue, parseMetadataLiteral } from "./rowWriteUtils";

describe("rowWriteUtils", () => {
  it("parses primitive literals", () => {
    expect(parseMetadataLiteral("true")).toBe(true);
    expect(parseMetadataLiteral("false")).toBe(false);
    expect(parseMetadataLiteral("null")).toBeNull();
    expect(parseMetadataLiteral("123.4")).toBe(123.4);
    expect(parseMetadataLiteral("alpha")).toBe("alpha");
  });

  it("parses json objects and arrays", () => {
    expect(parseMetadataLiteral('{"a":1}')).toEqual({ a: 1 });
    expect(parseMetadataLiteral('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it("adds or updates metadata key", () => {
    const next = mergeMetadataValue({ status: "open" }, "priority", "3");
    expect(next).toEqual({ status: "open", priority: 3 });
  });

  it("removes metadata key when value is empty", () => {
    const next = mergeMetadataValue({ status: "open", priority: 3 }, "priority", "   ");
    expect(next).toEqual({ status: "open" });
  });
});
