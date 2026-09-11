import { describe, expect, it } from "vitest";
import {
  filterMeaningfulSessions,
  relativeTime,
  removeSession,
  renameSession,
  titleFromQuery,
  upsertSession,
  type SessionSummary
} from "./sessions";

const NOW = new Date("2026-09-11T12:00:00Z").getTime();

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

describe("titleFromQuery", () => {
  it("falls back to a default title for blank input", () => {
    expect(titleFromQuery("")).toBe("新对话");
    expect(titleFromQuery("   ")).toBe("新对话");
  });

  it("collapses internal whitespace", () => {
    expect(titleFromQuery("  查询  库存  ")).toBe("查询 库存");
  });

  it("truncates overly long queries", () => {
    const long = "这是一段非常非常长的问题用来测试标题截断逻辑是否按预期工作下去";
    expect(titleFromQuery(long)).toBe(`${long.slice(0, 24)}…`);
  });
});

describe("relativeTime", () => {
  it("formats recent, minutes, hours and days", () => {
    expect(relativeTime(iso(30_000), NOW)).toBe("刚刚");
    expect(relativeTime(iso(5 * 60_000), NOW)).toBe("5 分钟前");
    expect(relativeTime(iso(3 * 3_600_000), NOW)).toBe("3 小时前");
    expect(relativeTime(iso(2 * 86_400_000), NOW)).toBe("2 天前");
  });

  it("returns empty string for invalid input", () => {
    expect(relativeTime("not-a-date", NOW)).toBe("");
  });
});

describe("upsertSession", () => {
  it("inserts a new session to the front", () => {
    const existing: SessionSummary[] = [
      { threadId: "a", title: "A", createdAt: iso(1000) }
    ];
    const next: SessionSummary = { threadId: "b", title: "B", createdAt: iso(0) };
    expect(upsertSession(existing, next).map((s) => s.threadId)).toEqual(["b", "a"]);
  });

  it("moves an existing session to the front without duplicating", () => {
    const existing: SessionSummary[] = [
      { threadId: "a", title: "A", createdAt: iso(1000) },
      { threadId: "b", title: "B", createdAt: iso(2000) }
    ];
    const next: SessionSummary = { threadId: "b", title: "B2", createdAt: iso(0) };
    const result = upsertSession(existing, next);
    expect(result.map((s) => s.threadId)).toEqual(["b", "a"]);
    expect(result[0].title).toBe("B2");
  });
});

describe("renameSession", () => {
  it("updates only the matching session title", () => {
    const list: SessionSummary[] = [
      { threadId: "a", title: "A", createdAt: iso(1000) },
      { threadId: "b", title: "B", createdAt: iso(2000) }
    ];
    const result = renameSession(list, "b", "新标题");
    expect(result[0].title).toBe("A");
    expect(result[1].title).toBe("新标题");
  });
});

describe("session history lifecycle", () => {
  it("registers a session only when the first message is submitted", () => {
    let list: SessionSummary[] = [];

    // 点击「新建对话」：不产生任何条目（无对话内容的会话不入列）
    // 首次提交消息：以真实标题入列
    list = upsertSession(list, { threadId: "a", title: "查询库存", createdAt: iso(60_000) });

    // 继续在同一会话提交消息：保持原有标题
    list = upsertSession(list, { threadId: "a", title: "查询库存", createdAt: iso(0) });

    expect(list.map((session) => session.threadId)).toEqual(["a"]);
    expect(list.map((session) => session.title)).toEqual(["查询库存"]);
    expect(filterMeaningfulSessions(list).length).toBe(1);
  });
});

describe("removeSession", () => {
  it("removes only the matching session", () => {
    const list: SessionSummary[] = [
      { threadId: "a", title: "查询库存", createdAt: iso(2000) },
      { threadId: "b", title: "市场分析", createdAt: iso(1000) }
    ];
    expect(removeSession(list, "a").map((session) => session.threadId)).toEqual(["b"]);
  });

  it("returns the same list when the thread does not exist", () => {
    const list: SessionSummary[] = [
      { threadId: "a", title: "查询库存", createdAt: iso(1000) }
    ];
    expect(removeSession(list, "missing")).toEqual(list);
  });

  it("returns an empty list when removing the only session", () => {
    const list: SessionSummary[] = [
      { threadId: "a", title: "查询库存", createdAt: iso(1000) }
    ];
    expect(removeSession(list, "a")).toEqual([]);
  });
});

describe("filterMeaningfulSessions", () => {
  it("keeps only sessions that have a real title", () => {
    const list: SessionSummary[] = [
      { threadId: "a", title: "查询库存", createdAt: iso(2000) },
      { threadId: "b", title: "新对话", createdAt: iso(1000) }
    ];
    expect(filterMeaningfulSessions(list).map((session) => session.threadId)).toEqual(["a"]);
  });

  it("returns an empty list when all sessions are placeholders", () => {
    const list: SessionSummary[] = [
      { threadId: "a", title: "新对话", createdAt: iso(2000) },
      { threadId: "b", title: "新对话", createdAt: iso(1000) }
    ];
    expect(filterMeaningfulSessions(list)).toEqual([]);
  });
});