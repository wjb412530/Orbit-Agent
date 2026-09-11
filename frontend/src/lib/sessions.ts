export interface SessionSummary {
  threadId: string;
  title: string;
  createdAt: string;
}

const STORAGE_KEY = "orbit-agent.sessions";
const MAX_SESSIONS = 50;
const TITLE_MAX_LENGTH = 24;
export const DEFAULT_SESSION_TITLE = "新对话";

export function titleFromQuery(query: string): string {
  const clean = query.trim().replace(/\s+/g, " ");
  if (!clean) {
    return DEFAULT_SESSION_TITLE;
  }
  return clean.length > TITLE_MAX_LENGTH ? `${clean.slice(0, TITLE_MAX_LENGTH)}…` : clean;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return "刚刚";
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} 天前`;
  }

  return new Date(iso).toLocaleDateString("zh-CN");
}

export function upsertSession(list: SessionSummary[], next: SessionSummary): SessionSummary[] {
  const without = list.filter((session) => session.threadId !== next.threadId);
  return [next, ...without].slice(0, MAX_SESSIONS);
}

export function renameSession(
  list: SessionSummary[],
  threadId: string,
  title: string
): SessionSummary[] {
  return list.map((session) =>
    session.threadId === threadId ? { ...session, title } : session
  );
}

export function removeSession(list: SessionSummary[], threadId: string): SessionSummary[] {
  return list.filter((session) => session.threadId !== threadId);
}

export function isMeaningfulSession(session: SessionSummary): boolean {
  return session.title !== DEFAULT_SESSION_TITLE;
}

export function filterMeaningfulSessions(list: SessionSummary[]): SessionSummary[] {
  return list.filter(isMeaningfulSession);
}

export function loadSessions(): SessionSummary[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return filterMeaningfulSessions(
      parsed.filter(
        (item): item is SessionSummary =>
          item && typeof item.threadId === "string" && typeof item.title === "string"
      )
    );
  } catch {
    return [];
  }
}

export function persistSessions(list: SessionSummary[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 忽略存储异常，避免影响主流程
  }
}