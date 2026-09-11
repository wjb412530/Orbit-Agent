export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TurnLike {
  content: string;
  result: string;
}

export const MAX_HISTORY_TURNS = 100;
export const MAX_HISTORY_CONTENT_LENGTH = 20000;
const MAX_HISTORY_THREADS = 50;
const HISTORY_KEY = "orbit-agent.thread-history";

export type ThreadHistoryMap = Record<string, HistoryTurn[]>;

export function turnsToHistory(turns: TurnLike[]): HistoryTurn[] {
  const history: HistoryTurn[] = [];
  turns.forEach((turn) => {
    if (turn.content.trim()) {
      history.push({ role: "user", content: turn.content });
    }
    if (turn.result.trim()) {
      history.push({ role: "assistant", content: turn.result });
    }
  });
  return history;
}

export function historyToTurns(history: HistoryTurn[]): TurnLike[] {
  const turns: TurnLike[] = [];
  history.forEach((entry) => {
    if (entry.role === "user") {
      turns.push({ content: entry.content, result: "" });
    } else if (turns.length > 0 && !turns[turns.length - 1].result) {
      turns[turns.length - 1].result = entry.content;
    } else {
      turns.push({ content: "", result: entry.content });
    }
  });
  return turns;
}

export function capHistory(history: HistoryTurn[]): HistoryTurn[] {
  return history.slice(-MAX_HISTORY_TURNS).map((entry) => ({
    role: entry.role,
    content:
      entry.content.length > MAX_HISTORY_CONTENT_LENGTH
        ? `${entry.content.slice(0, MAX_HISTORY_CONTENT_LENGTH)}…`
        : entry.content
  }));
}

export function loadThreadsHistory(): ThreadHistoryMap {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ThreadHistoryMap;
  } catch {
    return {};
  }
}

export function loadThreadHistory(threadId: string): HistoryTurn[] {
  const list = loadThreadsHistory()[threadId];
  return Array.isArray(list) ? list : [];
}

export function saveThreadHistory(threadId: string, history: HistoryTurn[]): void {
  try {
    const all = loadThreadsHistory();
    delete all[threadId];
    if (history.length > 0) {
      all[threadId] = capHistory(history);
    }
    // 防止 localStorage 超限：仅保留最近活跃的会话历史
    const keys = Object.keys(all);
    while (keys.length > MAX_HISTORY_THREADS) {
      delete all[keys[0]];
      keys.shift();
    }
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {
    // 静默降级：存储失败（隐私模式/配额满）不影响会话功能
  }
}