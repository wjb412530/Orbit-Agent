# 工具插拔式开关调用设计（2026-09-12）

## 背景与目标

当前对话栏中的四个工具（联网搜索 / 数据库查询 / RAGFlow 知识库 / PDF 报告）以「点击预填固定提示词」的方式工作：点击 chip 会把一段写死的话术填入输入框，再由用户手动提交。这种方式与「豆包」的工具调用体验不一致——豆包采用**插拔式开关**：用户在输入区点选工具开关，提交任务时开关状态随请求直达后端，由后端决定本次任务真正具备哪些能力。

本次改造目标：

1. 四个工具 chip 从「预填话术」改为 **toggle 开关**（可多选、可随时切换、点击不再改动输入框内容）。
2. 开关真实生效：提交任务时把启用清单传给后端，后端子按清单**真裁剪**子智能体与交付工具（不是提示词软控制）。
3. 默认状态**全关**，允许零工具直接提问（主智能体用自身知识 + 已上传文件作答）。
4. 体验对齐豆包：运行中切换开关只影响下一次任务。

## 现状

- 前端：`ToolChips` 点击调用 `handleUseTool` → `composePrefill` 预填 → 聚焦输入框；提交经由 `startTask(query, threadId)` 走 `POST /api/task`。
- 后端：`TaskRequest{query, thread_id}`；`get_main_agent()` 为全局单例，固定注册三个字典式子智能体（network / database / ragflow）+ 六个主工具（generate_markdown、convert_md_to_pdf、read_file_content、analyze_image、generate_image、transcribe_audio）；`run_deep_agent(query, session_id)` 内提示词为静态拼接。
- 提示词矛盾点：`app/prompt/prompts.yml` 主提示词硬编码「协调三个专家助手」、第 47 行「必须先调用子智能体」、第 35 行与 37-41 行自相矛盾（既说"你没有生成文件的能力"又说"你掌握 generate_markdown 工具"）。裁剪场景下这些静态表述会误导模型。

## 已确认的设计决策

| 决策点 | 结论 |
| --- | --- |
| 插拔语义 | 后端真裁剪（按清单注册子智能体/工具），非提示词软控制 |
| 默认状态 | 全关；会话切换/刷新重置；不持久化 |
| 零工具提交 | 允许，主智能体凭自身知识 + 已上传文件作答 |
| 后端裁剪实现 | 按启用组合懒缓存 agent 实例，checkpointer 全局单例共享（方案 A） |
| 基础工具划分 | `read_file_content / analyze_image / generate_image / transcribe_audio` 始终保留，不受开关管控；`pdf` 开关同时控制 `generate_markdown` 与 `convert_md_to_pdf` 两个交付工具 |
| 后端测试框架 | 不引入 pytest，用标准库 `unittest`（`uv run python -m unittest`） |

## 后端设计

### 1. API 契约（`app/api/server.py`）

```python
class TaskRequest(BaseModel):
    query: str
    thread_id: str = None
    tools: list[str] = []   # 新增，白名单: network | database | ragflow | pdf
```

- 非法 kind 静默过滤（宽容策略，不返回 4xx）。
- 旧调用方（不传 `tools`）向后兼容：默认空列表 = 全关。

### 2. 组装纯函数（`app/agent/main_agent.py`）

新增纯函数，便于单测与复用：

```python
ALLOWED_TOOL_KINDS = {"network", "database", "ragflow", "pdf"}

SUBAGENT_BY_KIND = {
    "network": network_search_agent,
    "database": database_query_agent,
    "ragflow": knowledge_base_agent,
}

BASE_TOOLS = [read_file_content, analyze_image, generate_image, transcribe_audio]
PDF_TOOLS = [generate_markdown, convert_md_to_pdf]

def resolve_agent_config(enabled: frozenset[str]) -> tuple[list, list]:
    """返回 (tools, subagents)，按启用清单真裁剪。"""
    kinds = enabled & ALLOWED_TOOL_KINDS
    tools = list(BASE_TOOLS)
    if "pdf" in kinds:
        tools.extend(PDF_TOOLS)
    subagents = [SUBAGENT_BY_KIND[k] for k in ("network", "database", "ragflow") if k in kinds]
    return tools, subagents
```

### 3. 按组合懒缓存的 agent 实例

```python
_agent_cache: dict[frozenset, object] = {}

async def get_main_agent(enabled: frozenset[str]):
    if enabled not in _agent_cache:
        tools, subagents = resolve_agent_config(enabled)
        system_prompt = build_system_prompt(enabled)  # 见「提示词动态化」
        _agent_cache[enabled] = create_deep_agent(
            model=vl_model,
            system_prompt=system_prompt,
            tools=tools,
            checkpointer=await get_checkpointer(),
            subagents=subagents,
        )
    return _agent_cache[enabled]
```

- 组合最多 16 种，每组合只构建一次；checkpointer 单例跨组合共享（LangGraph checkpointer 与 graph 实例解耦）。
- `run_deep_agent(task_query, session_id, enabled_tools)` 解析为 frozenset 后透传。

### 4. 提示词动态化

- `app/prompt/prompts.yml` 最小修订：
  - 「负责协调三个专家助手」→「负责协调专家助手（以系统注入的可用清单为准）」
  - 「你的团队成员如下：1/2/3」段落改为「团队成员由系统按需注入」
  - 修复第 35 行与 37-41 行的自相矛盾（保留「文件生成由你自己用工具完成」语义，删除「你没有生成文件的能力」）
- 新增 `build_system_prompt(enabled: frozenset[str])`：在 yml 主提示词尾部追加动态段：
  ```
  【本次可用能力】
  本次任务启用的信息检索助手: ...（无则注明"未启用任何检索助手，请基于自身知识作答，事实性内容需说明来源局限"）
  本次任务是否可生成 Markdown/PDF 交付文件: 是/否（否时不得调用 generate_markdown / convert_md_to_pdf，若用户要求生成文件需说明本次未开启该工具）
  ```
- 因缓存键 = 启用组合，动态段与组合一一对应，缓存语义不受影响。

## 前端设计

### 1. ToolChips 改为 toggle 组（`frontend/src/components/ToolChips.tsx`）

```tsx
interface ToolChipsProps {
  enabled: ToolKind[];
  onToggle: (kind: ToolKind) => void;
}
```

- 每个 chip：`aria-pressed={checked}`，class `tool-chip tool-chip--active`（选中时）。
- 点击只切开关，不再调用任何预填逻辑。
- 选中态样式：品牌蓝 `--brand` 实心背景 + 白字 + `--brand` 描边；未选中：`--surface-soft` 底 + `--line` 描边 + `--muted-strong` 字色。
- 位置不变：仍位于附件按钮右侧的同一水平工具条（`composer-left-actions` 内）。

### 2. toolShelf 精简（`frontend/src/lib/toolShelf.ts`）

- 保留 `ToolKind`、`ToolSpec`、`TOOL_SHELF`（示例卡片仍需 `label/icon/prompt`）。
- 删除 `composePrefill`（唯一使用方是 ToolChips 预填，已废弃）与 `getToolPrompt`。
- 新增纯函数 `serializeTools(kinds: Iterable<ToolKind>): string[]`：把开关集合序列化为 API 白名单字符串数组（供提交与测试用）。

### 3. App 状态与提交（`frontend/src/App.tsx`）

- `const [enabledTools, setEnabledTools] = useState<Set<ToolKind>>(new Set())`（默认全关）。
- `handleToggleTool(kind)`：存在则删、不存在则加。
- `handleNewSession` / `handleSwitchSession` 时重置为空集（不持久化）。
- `handleSubmit` 将 `serializeTools(enabledTools)` 传入 `session.submitTask(submitQuery, tools)`。
- 删除 `handleUseTool`、`autofocusToken` state，及 `ChatComposer` 的 `autoFocusToken` prop（唯一使用方消失）。

### 4. 请求链

- `frontend/src/lib/api.ts`：`startTask(query, threadId, tools: string[])`，body 增加 `tools`。
- `frontend/src/hooks/useDeepAgentSession.ts`：`submitTask(query, tools)` 透传。
- 示例任务卡片（TASK_EXAMPLES）行为不变：点击仍预填话术（替换 `handleSuggestedPrompt` 未变），提交时同样携带当前开关状态。

## 数据流

```
点击 chip → onToggle → setEnabledTools（仅影响下次提交）
提交 → startTask(query, threadId, serializeTools(enabled))
→ POST /api/task {query, thread_id, tools}
→ run_task: 白名单过滤 → asyncio.create_task(_run_bounded(query, id, tools))
→ run_deep_agent(query, id, frozenset(tools))
→ get_main_agent(enabled): 缓存命中或按组合构建
→ agent.astream(...) 执行
→ ToolMonitor / WebSocket 事件流 → 前端展示（不变）
```

## 错误处理

- 后端白名单过滤非法 kind；`tools` 缺省 = 全关（兼容旧脚本）。
- 前端以 TS 类型约束 kind 合法性；全关提交为合法行为。
- agent 缓存字典仅追加，不删除（进程生命周期内最多 16 项，无内存风险）。

## 测试（TDD）

### 后端（标准库 unittest，新目录 `tests/`）

`tests/test_agent_config.py` 覆盖 `resolve_agent_config`：
- 空集合 → 仅 BASE_TOOLS、subagents 为空
- 单个 kind（network / database / ragflow / pdf）各自映射正确
- pdf → tools 含 generate_markdown 与 convert_md_to_pdf
- 组合（如 network+pdf）→ subagents 与 tools 均正确
- 非法 kind 被过滤；BASE_TOOLS 恒存在（幂等，不因 pdf 开关丢失）

运行：`uv run python -m unittest tests.test_agent_config -v`

### 前端（vitest）

- 更新 `toolShelf.test.ts`：删除 `composePrefill`/`getToolPrompt` 用例，新增 `serializeTools` 用例（顺序稳定、去重、类型安全）。
- 组件交互不做 RTL 测试（项目无 jsdom 配置），以截图验证选中态样式与 `aria-pressed`。

### 端到端自检

1. `pnpm test`、`pnpm build` 通过。
2. `uv run python -m unittest` 通过。
3. `uv run python scripts/submit_test_task.py`（不传 tools）验证向后兼容。
4. 手动 curl 一次带 `tools: ["network"]` 的任务，确认后端日志显示启用裁剪。
5. 无头浏览器截图：chips 默认全灰；点选后变蓝实心；零工具可提交。

## 范围外（明确不做）

- 不做开关状态持久化（每次会话重置为全关）。
- 不新增后端测试依赖（pytest 等）。
- 不改动示例任务卡片与上传附件、录音等其他输入能力。
- 不调整 WebSocket 事件协议与 ToolMonitor 上报逻辑。