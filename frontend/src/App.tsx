import {
  ApiOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  ToolOutlined
} from "@ant-design/icons";
import { Alert, App as AntApp, Button, Popconfirm } from "antd";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "./components/ChatComposer";
import { ConversationThread } from "./components/ConversationThread";
import type { ChatTurn } from "./components/ConversationThread";
import { API_BASE_URL, WS_BASE_URL } from "./lib/config";
import { historyToTurns, loadThreadHistory, saveThreadHistory, turnsToHistory } from "./lib/history";
import { buildMediaPrompt } from "./lib/media";
import { relativeTime } from "./lib/sessions";
import { useDeepAgentSession } from "./hooks/useDeepAgentSession";
import type { ConnectionState, UploadedItem } from "./types";

function connectionLabel(state: ConnectionState): string {
  const labels: Record<ConnectionState, string> = {
    connecting: "连接中",
    connected: "已连接",
    reconnecting: "重连中",
    closed: "已关闭"
  };
  return labels[state];
}

function createTurn(content: string): ChatTurn {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    content,
    events: [],
    files: [],
    isRunning: true,
    result: "",
    timestamp: new Date().toISOString()
  };
}

export default function App() {
  const { message } = AntApp.useApp();
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const turnsRef = useRef<ChatTurn[]>(turns);
  const streamRef = useRef<HTMLElement | null>(null);
  const session = useDeepAgentSession();

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    // 仅在有任务活动时才合并会话状态，避免切换历史会话时把空状态覆盖到历史消息上
    if (!session.isRunning && session.events.length === 0 && !session.result) {
      return;
    }

    const previous = turnsRef.current;
    if (previous.length === 0) {
      return;
    }

    const latestTurn = previous[previous.length - 1];
    const nextTurns = [
      ...previous.slice(0, -1),
      {
        ...latestTurn,
        events: session.events,
        files: session.files,
        isRunning: session.isRunning,
        result: session.result
      }
    ];
    turnsRef.current = nextTurns;
    setTurns(nextTurns);

    if (!session.isRunning && session.result) {
      // 任务完成：立即持久化当前对话，避免直接刷新导致历史丢失
      saveThreadHistory(session.threadId, turnsToHistory(nextTurns));
    }
  }, [session.events, session.files, session.isRunning, session.result, session.threadId]);

  useEffect(() => {
    const streamNode = streamRef.current;
    if (!streamNode) {
      return;
    }

    window.requestAnimationFrame(() => {
      streamNode.scrollTo({
        top: streamNode.scrollHeight,
        behavior: "smooth"
      });
    });
  }, [turns]);

  async function handleSubmit() {
    const cleanQuery = query.trim();
    const submitQuery =
      cleanQuery ||
      buildMediaPrompt(session.uploadedItems) ||
      (session.uploadedItems.length > 0 ? "请阅读我上传的文件并总结要点。" : "");

    if (!submitQuery) {
      message.warning("请输入研搜任务");
      return;
    }

    const nextTurn = createTurn(submitQuery);
    setTurns((previous) => [...previous, nextTurn]);
    setQuery("");

    try {
      await session.submitTask(submitQuery);
      message.success("任务已启动，执行过程会显示在对话中");
    } catch (error) {
      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === nextTurn.id
            ? {
                ...turn,
                isRunning: false,
                result: error instanceof Error ? error.message : "任务启动失败"
              }
            : turn
        )
      );
      message.error(error instanceof Error ? error.message : "任务启动失败");
    }
  }

  async function handleCancel() {
    try {
      const response = await session.cancelCurrentTask();
      message.info(response.status === "cancelling" ? "取消请求已发送，正在等待当前调用结束" : "任务已取消");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "取消任务失败");
    }
  }

  async function handleUpload(items: UploadedItem[]) {
    try {
      const response = await session.uploadFiles(items);
      message.success(`已上传 ${response.files.length} 个文件`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
    }
  }

  function handleSuggestedPrompt(prompt: string) {
    setQuery((current) => (current.trim() ? current : prompt));
  }

  function handleRemoveFile(filename: string) {
    session.removeUploadedFile(filename).catch((error) => {
      message.error(error instanceof Error ? error.message : "删除文件失败");
    });
  }

  function persistCurrentTurns() {
    saveThreadHistory(session.threadId, turnsToHistory(turns));
  }

  function restoreHistory(threadId: string): ChatTurn[] {
    return historyToTurns(loadThreadHistory(threadId)).map((turn, index) => ({
      id: `history-${threadId}-${index}`,
      content: turn.content,
      events: [],
      files: [],
      isRunning: false,
      result: turn.result,
      timestamp: new Date().toISOString()
    }));
  }

  function handleNewSession() {
    persistCurrentTurns();
    session.resetSession();
    setTurns([]);
    setQuery("");
  }

  function handleSwitchSession(threadId: string) {
    if (threadId === session.threadId) {
      return;
    }
    persistCurrentTurns();
    session.switchSession(threadId);
    setTurns(restoreHistory(threadId));
    setQuery("");
  }

  function handleDeleteSession(targetThreadId: string) {
    const isCurrent = targetThreadId === session.threadId;
    if (isCurrent) {
      if (session.isRunning) {
        session.cancelCurrentTask().catch(() => undefined);
      }
      setTurns([]);
      setQuery("");
    }
    // 同时清除本地保存的对话记忆（saveThreadHistory 空数组即删除该会话条目）
    saveThreadHistory(targetThreadId, []);
    session.deleteSession(targetThreadId);
    message.success("会话已删除");
  }

  const online = session.connectionState === "connected";

  return (
    <div className="chat-app-shell min-h-dvh">
      <aside className="chat-sidebar" aria-label="会话信息">
        <div className="sidebar-brand">
          <span className="panel-kicker">ORBIT-AGENT</span>
          <h1>枢弈</h1>
          <p>对话式多智能体研究台</p>
        </div>

        <Button className="new-chat-button" block onClick={handleNewSession}>
          新建对话
        </Button>

        <div className="sidebar-section sidebar-sessions">
          <span className="sidebar-label">历史记录</span>
          {session.sessions.length === 0 ? (
            <p className="session-empty">暂无历史对话</p>
          ) : null}
          <ul className="session-list" aria-label="历史对话">
            {session.sessions.map((item) => (
              <li className="session-item-row" key={item.threadId}>
                <button
                  className={`session-item ${item.threadId === session.threadId ? "session-item--active" : ""}`}
                  onClick={() => handleSwitchSession(item.threadId)}
                  type="button"
                >
                  <span className="session-item-title">{item.title}</span>
                  <span className="session-item-time">{relativeTime(item.createdAt)}</span>
                </button>
                <Popconfirm
                  cancelText="取消"
                  description="删除后对话内容与本地记忆将无法恢复"
                  okButtonProps={{ danger: true }}
                  okText="删除"
                  onConfirm={() => handleDeleteSession(item.threadId)}
                  title="删除该会话？"
                >
                  <button
                    aria-label={`删除会话：${item.title}`}
                    className="session-item-delete"
                    title="删除该会话"
                    type="button"
                  >
                    <DeleteOutlined aria-hidden />
                  </button>
                </Popconfirm>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-status-list">
          <div className={`sidebar-status ${online ? "sidebar-status--online" : "sidebar-status--warn"}`}>
            <ApiOutlined aria-hidden />
            <span>WebSocket</span>
            <strong>{connectionLabel(session.connectionState)}</strong>
          </div>
          <div className="sidebar-status">
            <BranchesOutlined aria-hidden />
            <span>助手调度</span>
            <strong>{session.stats.assistantEvents}</strong>
          </div>
          <div className="sidebar-status">
            <ToolOutlined aria-hidden />
            <span>工具调用</span>
            <strong>{session.stats.toolEvents}</strong>
          </div>
          <div className={session.stats.errorEvents > 0 ? "sidebar-status sidebar-status--error" : "sidebar-status"}>
            <CloseCircleOutlined aria-hidden />
            <span>异常</span>
            <strong>{session.stats.errorEvents}</strong>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">AGENTS</span>
          <ul className="agent-mini-list">
            <li>
              <CloudServerOutlined aria-hidden />
              网络搜索助手
            </li>
            <li>
              <DatabaseOutlined aria-hidden />
              数据库查询助手
            </li>
            <li>
              <FileSearchOutlined aria-hidden />
              RAGFlow 助手
            </li>
          </ul>
        </div>

        <div className="sidebar-section sidebar-endpoints">
          <span className="sidebar-label">ENDPOINTS</span>
          <code>{API_BASE_URL}</code>
          <code>{WS_BASE_URL}</code>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-topbar">
          <div>
            <span className="panel-kicker">CHAT WORKSPACE</span>
            <h2>枢弈对话</h2>
          </div>
          <div className={`run-indicator ${session.isRunning ? "run-indicator--live" : ""}`}>
            {session.isRunning ? <BranchesOutlined aria-hidden /> : <CheckCircleOutlined aria-hidden />}
            {session.isRunning ? "研搜中" : "待命"}
          </div>
        </header>

        {session.lastError ? (
          <Alert
            className="chat-alert"
            message={session.lastError}
            showIcon
            type="error"
          />
        ) : null}

        <section className="chat-stream-panel" ref={streamRef}>
          <ConversationThread
            onUseExample={setQuery}
            turns={turns}
          />
        </section>

        <ChatComposer
          isCancelling={session.isCancelling}
          isRunning={session.isRunning}
          isUploading={session.isUploading}
          onCancel={handleCancel}
          onError={(error) => message.error(error)}
          onQueryChange={setQuery}
          onRemoveFile={handleRemoveFile}
          onSubmit={handleSubmit}
          onSuggestedPrompt={handleSuggestedPrompt}
          onUpload={handleUpload}
          query={query}
          uploadedItems={session.uploadedItems}
        />
      </main>
    </div>
  );
}
