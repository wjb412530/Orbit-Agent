import { describe, expect, it } from "vitest";
import {
  composePrefill,
  getToolPrompt,
  TOOL_SHELF,
  type ToolKind
} from "./toolShelf";

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

  it("fixes the duplicated 请 in the database prompt", () => {
    const database = TOOL_SHELF.find((tool) => tool.kind === "database");
    expect(database).toBeDefined();
    expect(database?.prompt).toContain("请使用数据库查询工具");
    expect(database?.prompt).not.toContain("请请");
  });

  it("asks for a PDF deliverable in the pdf prompt", () => {
    const pdf = TOOL_SHELF.find((tool) => tool.kind === "pdf");
    expect(pdf).toBeDefined();
    expect(pdf?.prompt).toContain("转 PDF");
    expect(pdf?.prompt).toContain("PDF");
  });
});

describe("getToolPrompt", () => {
  it("returns the prompt of a known tool kind", () => {
    EXPECTED_KINDS.forEach((kind) => {
      const spec = TOOL_SHELF.find((tool) => tool.kind === kind);
      expect(getToolPrompt(kind)).toBe(spec?.prompt);
    });
  });

  it("throws for an unknown tool kind", () => {
    expect(() => getToolPrompt("unknown" as ToolKind)).toThrow();
  });
});

describe("composePrefill", () => {
  it("returns the tool prompt when the input is empty", () => {
    const prompt = getToolPrompt("pdf");
    expect(composePrefill("", prompt)).toBe(prompt);
  });

  it("replaces existing input with the tool prompt", () => {
    const prompt = getToolPrompt("network");
    expect(composePrefill("之前输入的内容", prompt)).toBe(prompt);
  });
});