import { describe, expect, it } from "vitest";
import { serializeTools, TOOL_SHELF, type ToolKind } from "./toolShelf";

const EXPECTED_KINDS: ToolKind[] = ["network", "database", "ragflow", "pdf"];

describe("TOOL_SHELF", () => {
  it("contains exactly the four expected tools", () => {
    expect(TOOL_SHELF.map((tool) => tool.kind).sort()).toEqual(
      [...EXPECTED_KINDS].sort()
    );
  });

  it("has unique kinds and non-empty labels and prompts", () => {
    const kinds = TOOL_SHELF.map((tool) => tool.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    TOOL_SHELF.forEach((tool) => {
      expect(tool.label.trim().length).toBeGreaterThan(0);
      expect(tool.prompt.trim().length).toBeGreaterThan(0);
    });
  });
});

describe("serializeTools", () => {
  it("returns an empty array when nothing is enabled", () => {
    expect(serializeTools([])).toEqual([]);
  });

  it("serializes kinds in TOOL_SHELF order regardless of input order", () => {
    expect(serializeTools(["pdf", "network"])).toEqual(["network", "pdf"]);
  });

  it("deduplicates repeated kinds", () => {
    expect(serializeTools(["database", "database", "pdf"])).toEqual([
      "database",
      "pdf"
    ]);
  });

  it("serializes all four kinds", () => {
    expect(serializeTools(EXPECTED_KINDS)).toEqual(EXPECTED_KINDS);
  });

  it("accepts any iterable, including a Set", () => {
    expect(serializeTools(new Set<ToolKind>(["ragflow"]))).toEqual(["ragflow"]);
  });
});