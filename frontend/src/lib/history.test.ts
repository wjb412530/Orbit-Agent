import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capHistory,
  historyToTurns,
  loadThreadHistory,
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_HISTORY_TURNS,
  saveThreadHistory,
  turnsToHistory
} from "./history";

describe("turnsToHistory", () => {
  it("flattens turns into a user/assistant sequence", () => {
    const history = turnsToHistory([
      { content: "问题1", result: "答案1" },
      { content: "", result: "孤立的回答" }
    ]);
    expect(history).toEqual([
      { role: "user", content: "问题1" },
      { role: "assistant", content: "答案1" },
      { role: "assistant", content: "孤立的回答" }
    ]);
  });

  it("skips blank content", () => {
    const history = turnsToHistory([
      { content: "问题", result: "" },
      { content: "   ", result: "" }
    ]);
    expect(history).toEqual([{ role: "user", content: "问题" }]);
  });
});

describe("historyToTurns", () => {
  it("groups a user/assistant sequence back into turns", () => {
    const turns = historyToTurns([
      { role: "user", content: "问题1" },
      { role: "assistant", content: "答案1" },
      { role: "assistant", content: "孤立的回答" }
    ]);
    expect(turns).toEqual([
      { content: "问题1", result: "答案1" },
      { content: "", result: "孤立的回答" }
    ]);
  });

  it("returns an empty list for empty history", () => {
    expect(historyToTurns([])).toEqual([]);
  });
});

describe("capHistory", () => {
  it("keeps only the latest MAX_HISTORY_TURNS entries", () => {
    const history = Array.from({ length: MAX_HISTORY_TURNS + 5 }, (_, index) => ({
      role: "user" as const,
      content: `消息${index}`
    }));
    const capped = capHistory(history);
    expect(capped.length).toBe(MAX_HISTORY_TURNS);
    expect(capped[0].content).toBe("消息5");
  });

  it("trims overly long content", () => {
    const long = "a".repeat(MAX_HISTORY_CONTENT_LENGTH + 50);
    const capped = capHistory([{ role: "user", content: long }]);
    expect(capped[0].content).toHaveLength(MAX_HISTORY_CONTENT_LENGTH + 1);
    expect(capped[0].content.endsWith("…")).toBe(true);
  });
});

describe("saveThreadHistory", () => {
  function installLocalStorage(): void {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        }
      }
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes the thread memory when saving an empty history while keeping others", () => {
    installLocalStorage();
    saveThreadHistory("a", [{ role: "user", content: "问题1" }]);
    saveThreadHistory("b", [{ role: "user", content: "问题2" }]);

    saveThreadHistory("a", []);

    expect(loadThreadHistory("a")).toEqual([]);
    expect(loadThreadHistory("b")).toEqual([{ role: "user", content: "问题2" }]);
  });
});