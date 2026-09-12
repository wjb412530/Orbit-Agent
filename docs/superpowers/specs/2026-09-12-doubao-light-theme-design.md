# Orbit-Agent 前端明亮化改版（豆包式纯白风格）设计文档

日期：2026-09-12
状态：已与用户确认（风格方向 = 豆包式纯白；实现路线 = CSS 主题重构 + 组件局部改造）

## 1. 背景与目标

当前前端为「深色霓虹」风格（近黑底色 + 青色网格线）。用户要求参考「豆包」前端的设计理念与风格，实现：

1. 整个页面变得更明亮（豆包式纯白风格）。
2. 隐藏侧边栏「ENDPOINTS」区块。
3. 将侧边栏「AGENTS」区块移除，改为对话栏中可点击使用的工具。
4. 将「可主动选择返回 PDF」的能力升级为对话栏中可点击使用的「PDF 报告」工具。

已通过澄清确认的交互决策：

- AGENTS 工具（网络搜索 / 数据库查询 / RAGFlow 知识库）点击后：把该工具的预设任务提示预填进输入框并聚焦，由用户确认（可修改）后发送。
- PDF 工具 = 「生成 PDF 报告」工具按钮（预填「生成 Markdown 报告并转 PDF」任务），不是产物文件卡片。
- 运行状态改为顶栏轻量状态点；侧边栏只保留品牌、新建对话、历史记录。

## 2. 风格规范（豆包式纯白）

### 2.1 色彩令牌（styles.css `:root` 全面替换）

| 令牌 | 新值 | 用途 |
| --- | --- | --- |
| `--bg` | `#f2f3f5` | 页面底色 |
| `--surface` | `#ffffff` | 卡片 / 面板底 |
| `--surface-soft` | `#f7f8fa` | 次级底（气泡、输入条、悬停态） |
| `--line` | `#e5e6eb` | 常规边框 |
| `--line-strong` | `#c9cdd4` | 强边框 / 分隔 |
| `--text` | `#1f2329` | 主文字 |
| `--muted` | `#86909c` | 次要文字 |
| `--muted-strong` | `#4e5969` | 次级正文 |
| `--brand` | `#3370ff` | 主色（豆包蓝：按钮、活跃态、链接） |
| `--brand-soft` | `#eef3ff` | 浅蓝底（工具 chips、历史活跃项） |
| `--brand-line` | `#d6e4ff` | 浅蓝边框 |
| `--green` | `#00b42a` | 连接正常状态点 |
| `--amber` | `#ff7d00` | 运行中状态点 / 强调 |
| `--red` | `#f53f3f` | 错误 / 删除 |
| `--violet` | `#722ed1` | 辅助强调（保留语义） |
| `--shadow` | `0 8px 24px rgba(31,35,41,0.08)` | 卡片轻阴影 |

- `color-scheme: light`；`html`/`body` 背景改为纯浅色，移除深色多层渐变与网格线、`repeating-linear-gradient` 装饰全部移除。
- 字体保持现有栈：`"PingFang SC", "Microsoft YaHei", system-ui, sans-serif`；等宽数字部分保留 `JetBrains Mono` 栈。

### 2.2 圆角 / 阴影 / 组件质感

- 卡片圆角 12–16px；按钮/chips 圆角 8–20px（capsule）；输入条 capsule 24px。
- 阴影只用于悬浮卡片（桌面主面板），小元素用 1px `--line` 边框表达层级，不使用霓虹 glow。
- 深色半透明背景（`rgba(255,255,255,0.0x)` 类）全部改写为浅色体系对应值。

## 3. 布局设计

```
┌───────────────┬──────────────────────────────────────┐
│ 侧边栏(白底)   │ 顶栏：枢弈对话 · 多智能体研究台     ● 已连接 │
│ 枢弈 (logo)    │ ┌────────────────────────────────┐ │
│ [＋ 新建对话]  │ │ 工具区: [🌐联网][🗄数据库]       │ │
│ ── 历史记录 ── │ │         [📚知识库][📄PDF报告]   │ │
│ · 会话A       │ │ ─────────────────────────────  │ │
│ · 会话B       │ │ 对话气泡（蓝=用户 灰=助手）      │ │
│ · 会话C       │ │                                │ │
│               │ └────────────────────────────────┘ │
│               │ 输入条: [文本........] [附件][🎤][↑] │
└───────────────┴──────────────────────────────────────┘
```

- **侧边栏**（约 240px，白底 + 右侧 1px 分隔线）：品牌「枢弈」、蓝色「新建对话」按钮、「历史记录」列表。
  - 移除：「AGENTS」区块、「ENDPOINTS」区块、`sidebar-status-list` 状态条。
  - 保留既有行为与修复：`overflow-y: auto`、`.sidebar-sessions { flex-shrink: 0 }`、历史条目 hover 删除按钮（样式随主题明亮化）。
- **顶栏**：左侧标题「枢弈对话」；右侧轻量状态点：绿点「已连接」/ 灰点「连接中/重连中」；任务运行中时变为橙点「研搜中」（与原 `run-indicator` 语义合并，移除统计数字）。
- **对话区**（白色圆角主面板）：
  - 面板顶部新增常驻工具区 `ToolChips`（4 个 chips，见 §4）。
  - 下方为现有 `ConversationThread`（气泡配色：用户=品牌蓝底白字，助手=`--surface-soft` 底深灰字）。
  - 空对话时的示例任务卡保留（与 `ToolChips` 共用同一工具定义源，避免文案重复）。
- **输入区**（`ChatComposer`）：白色 capsule 输入条 + 附件/图片/录音图标 + 蓝色圆形发送按钮；禁用态浅灰。

## 4. 组件改动明细（文件级）

### 4.1 新增 `frontend/src/lib/toolShelf.ts`（工具定义单一来源）

```ts
export type ToolKind = "network" | "database" | "ragflow" | "pdf";
export interface ToolSpec { kind: ToolKind; label: string; icon: string; prompt: string; }
export const TOOL_SHELF: ToolSpec[];          // 4 个工具
export function getToolPrompt(kind: ToolKind): string;
export function composePrefill(current: string, toolPrompt: string): string;
```

- 工具清单与提示词取自现有 `ConversationThread.tsx` 的 `TASK_EXAMPLES`：
  - `network`：联网趋势研判（原网络搜索提示）
  - `database`：药品库存排查（**顺带修正原文「请请使用」为「请使用」**）
  - `ragflow`：内部文档问答
  - `pdf`：生成交付报告（原文即「请使用 Markdown 文档生成工具和 Markdown 转 PDF 工具……转换成 PDF 保存到当前工作目录」）
- `composePrefill(current, toolPrompt)`：**直接返回 `toolPrompt`**（点击工具 = 用该任务替换输入框内容，语义简单可测）。

### 4.2 新增 `frontend/src/components/ToolChips.tsx`

- Props：`{ onUseTool: (prompt: string) => void }`。
- 渲染 4 个 chip（图标 + 文案），点击调用 `onUseTool(getToolPrompt(kind))`。
- 采用 antd Tag/Button 或原生 button + 样式类 `.tool-chip`（capsule、浅蓝底、hover 加深、focus-visible 描边）。

### 4.3 `frontend/src/App.tsx`

- 删除侧边栏中 AGENTS、ENDPOINTS、`sidebar-status-list` 三个区块及相关 import（`ApiOutlined` 等按需保留）。
- 顶栏 `run-indicator` 改为轻量状态点组件（内联，`connectionLabel` 与 `isRunning` 共同决定颜色与文案）。
- 在 `chat-stream-panel` 内、`ConversationThread` 上方渲染 `<ToolChips onUseTool={handleUseTool} />`。
- 新增 `handleUseTool(prompt)`：**直接用该提示替换输入框内容并聚焦**（对应 §4.1 `composePrefill` 语义）。
- 现有 `handleSuggestedPrompt`（示例卡的「仅当输入为空时预填」行为）保持不变，仅供 `ConversationThread` 示例卡使用，不与工具 chips 混淆。
- 其余逻辑（历史切换/删除、提交、取消、上传、WS）不变。

### 4.4 `frontend/src/components/ConversationThread.tsx`

- `TASK_EXAMPLES` 改从 `toolShelf.ts` 导入（保留示例卡 UI 与 `onUseExample` 回调不变），删除本地重复定义。

### 4.5 `frontend/src/components/ChatComposer.tsx` 与其余组件

- 仅样式明亮化（沿用 `styles.css` 类名改值），结构不动；发送按钮往返为品牌蓝。
- 为支持「预填并聚焦」，`ChatComposer` 允许新增最小改动的输入聚焦接口（例如 `autoFocusToken` prop：预填时变更该 token，组件内 effect 对 textarea 调用 `focus()`），不改动其余行为。
- `UploadPanel` / `FileDock` 等未接入或辅助组件同步替换颜色类（无逻辑变更）。

### 4.6 `frontend/src/styles.css`

- §2.1 令牌替换；深色渐变/霓虹描边/glow 全部移除；对 `.chat-sidebar`、`.session-item(-row/-delete)`、`.chat-topbar`、`.run-indicator`、`.tool-chip`、`.chat-composer` 等逐块改写为浅色样式。
- 必须保留既有可访问性修复：侧边栏 `overflow-y:auto`、历史区块不被压缩、删除按钮 `focus-visible` 可见。

## 5. 交互规格

1. 点击工具 chip → 输入框内容被该工具提示词替换并聚焦（textarea focus）；用户可编辑后点发送。
2. 发送流程不变：`handleSubmit` → 新建 turn → `session.submitTask`（首次提交登记会话入历史记录）。
3. 历史记录既有交互不变：点击切换、hover 删除（Popconfirm）、仅登记有内容会话。
4. 运行状态点：`connecting/reconnecting` 灰色、`connected` 绿色；`isRunning` 时显示橙点「研搜中」（优先级高于连接色）。

## 6. 测试策略（TDD）

新增/修改测试（先行 RED，再实现 GREEN）：

- `frontend/src/lib/toolShelf.test.ts`：
  - 4 个工具齐全、`kind` 唯一；
  - 每个 `prompt` 非空字符串；
  - `database` 提示不含「请请」；
  - `pdf` 提示包含「PDF」与「转 PDF」；
  - `composePrefill("", p)`、`composePrefill("旧内容", p)` 均返回 `p`。
- 既有 41 个测试保持全绿（sessions / history / media / audioRecording）。
- `pnpm build`（tsc -b && vite build）必须通过。

## 7. 视觉验证（强制）

按项目记忆要求「UI 改动必须验证实际渲染可见」：

1. 启动后端（8000）与前端（5173 dev）。
2. 使用浏览器控制打开 `http://127.0.0.1:5173/` 截图核对：明亮白底、侧边栏无 AGENTS/ENDPOINTS、工具区 4 chips 可见、状态点可见、历史记录条目可见。
3. 点击工具 chip 验证输入框预填；验证历史切换/删除按钮 hover 可见。

## 8. 非目标（明确不做）

- 双主题（深色保留/切换）不做。
- 后端任何改动不做（PDF 生成能力本身已存在）。
- PDF 产物预览卡片不做（FileDock 暂不接入，后续独立需求）。
- 移动端响应式重排不做（保持现有桌面布局，仅跟随色板）。