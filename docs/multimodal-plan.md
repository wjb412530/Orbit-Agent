# Orbit-Agent 多模态改造设计

> 状态：草案（待审阅）
> 目标：让 agent 支持多源数据输入（图片/音频/视频）与多源数据输出，并明确通信架构取舍。

## 1. 背景与现状

当前系统是「纯文本 + 文档」形态，四个层面均不支持多模态：

| 层面 | 现状 | 多模态障碍 |
| --- | --- | --- |
| 模型 | `app/agent/llm.py` 用 `qwen-max`（文本模型） | 无法理解图片/音频，是最大瓶颈 |
| 上传白名单 | `app/utils/safety.py` 仅 `.txt,.md,.pdf,.docx,.xlsx,.csv` | 无 `.jpg/.png/.mp3/.mp4` |
| 文件读取 | `app/tools/upload_file_read_tool.py` 只解析文档 | 无图像/音频/视频解析路径 |
| 输出 | 仅文本 + Markdown/PDF | 无图片/音频/视频生成 |

## 2. 总体架构（目标态）

```text
用户 ──HTTP multipart──> 上传(图片/音频/文档) ──> app/updated/session_{tid}/
                              │
                              ▼
                     ┌──────────────────────┐
                     │   主智能体（多模态）   │  qwen-vl-max  ← 读懂图片
                     │   子智能体（文本）      │  qwen-max      ← 搜索/数据库/RAG
                     └──────────────────────┘
                     /         |            \
           图片理解工具    音频转写工具     生图工具
           (vl 模型)   (qwen-audio-asr)  (通义万相 wanx)
                     \         |            /
                      └── 结果落 session_dir ──┘
                              │
          WebSocket 推「事件 + 文件 URL」(轻量，绝不推二进制)
                              │
                     前端 <img>/<audio>/<video> 按 URL 渲染
```

### 贯穿原则

1. **WebSocket 只传事件和文件 URL，绝不传二进制大文件**。
2. **HTTP 只传大文件**：上传走 multipart，结果下载走 GET。
3. **模型统一走 DashScope**：一张 API Key 打通理解/生图/转写，不引入新平台。

### 核心架构判断

- 音频/视频**不要**试图让 LLM 直接「听/看」，而是先降维成文本/图片：
  - 音频 → ASR 转文字 → 复用现有文本链路
  - 视频 → ffmpeg 抽帧 + 音频转写 → 图片 + 文字
  - 图片 → 直接多模态输入（唯一需要换模型的场景）

---

## 阶段 1：图片输入（难度低，收益直观，先做）

**目标**：用户上传图片，agent 能读懂图片内容（描述、识别、基于图回答）。

| 项 | 内容 |
| --- | --- |
| 新增依赖 | 无新库（base64 用标准库） |
| 新增环境变量 | `LLM_QWEN_VL=qwen-vl-max` |
| 改动文件 | `app/agent/llm.py`、`app/utils/safety.py`、新增 `app/tools/image_tool.py`、`app/agent/main_agent.py`、`app/prompt/prompts.yml`、前端上传组件 |

### 实现要点

1. `llm.py` 新增 `vl_model = init_chat_model("qwen-vl-max", model_provider="openai")`，主智能体用 `vl_model`，子智能体仍用文本 `model`（省成本、不动现有逻辑）。
2. `safety.py` 白名单加 `.jpg,.jpeg,.png,.webp`，`MAX_UPLOAD_MB` 视需要放宽。
3. 新增 `image_tool.py`（`analyze_image`）：从 `session_dir` 读图 → base64 编码成 data URL → 调 `vl_model.invoke(多模态消息)` 返回理解结果。本地图片不用公网图床，data URL 最省事。
4. 前端上传 `accept` 属性加图片类型。

### 验证与回滚

- **验证**：上传一张图 + 问「这张图里有什么」，agent 返回准确描述。
- **回滚**：`LLM_QWEN_VL` 不配或删除图片工具即可，零影响。

---

## 阶段 2：图片输出（难度低，最实用）

**目标**：agent 能根据文本描述生成图片，前端展示。

| 项 | 内容 |
| --- | --- |
| 新增依赖 | 建议加 `dashscope` SDK（生图走原生 API，非 OpenAI 兼容协议） |
| 新增环境变量 | `WANX_API_KEY`（或复用 `OPENAI_API_KEY`） |
| 改动文件 | 新增 `app/tools/generate_image_tool.py`、`main_agent.py`、`prompts.yml`、前端结果渲染 |

### 实现要点

1. 新增 `generate_image_tool.py`（`generate_image`）：调通义万相 wanx2.1 `text2image` → 结果图存 `session_dir/images/xxx.png` → 返回相对路径。
2. `task_result` 事件携带 `images: [url]` 字段（复用 `monitor.report_task_result`，扩展 data）。
3. 前端把 `images[]` 渲染成 `<img>`。

### 验证与回滚

- **验证**：提交「画一张深海探测机器人示意图」，前端显示生成的图片。
- **回滚**：删除工具即可。

---

## 阶段 3：音频输入（难度中，复用文本链路）

**目标**：用户上传音频，agent 转写后理解内容。

| 项 | 内容 |
| --- | --- |
| 新增依赖 | 视方案：DashScope ASR HTTP 调用（免 SDK）/ 或 `funasr` 本地 |
| 新增环境变量 | 无强制新增（复用 key） |
| 改动文件 | 新增 `app/tools/transcribe_audio_tool.py`、`safety.py` 白名单、前端上传 |

### 实现要点

1. 白名单加 `.mp3,.wav,.m4a`，音频较大需放宽 `MAX_UPLOAD_MB`。
2. 新增 `transcribe_audio_tool.py`（`transcribe_audio`）：读音频 → 调 `qwen-audio-asr`（DashScope Paraformer）→ 返回转写文字。
3. 转写文字进入现有文本消息流，agent 无需多模态能力即可理解音频（改动最小的桥接）。

### 验证与回滚

- **验证**：上传一段录音提问，agent 基于转写文字作答。
- **回滚**：删除工具即可。

---

## 4. 通信架构结论

| 决策 | 结论 |
| --- | --- |
| WebSocket 是否保留 | **保留**，继续承载事件流（进度/状态/结果 URL） |
| 是否换通信协议 | **不换**。SSE 单向会牺牲「取消/心跳」；WebTransport/gRPC 过重 |
| 新增约束 | 结果 URL 经 WebSocket 推送，二进制一律走 HTTP |

前端新增的只有「结果多模态渲染」：`<img>`、`<audio>`、`<video>`（视频留给后续，架构已预留）。

### 通信方案对比（备查）

| 方案 | 双向 | 复杂度 | 适用场景 | 判断 |
| --- | --- | --- | --- | --- |
| WebSocket | ✅ | 中 | 实时双向事件流 | 当前合理，保留 |
| SSE | ❌ 单向 | 低 | 服务端→客户端进度流 | 够用，但牺牲取消/心跳 |
| WebTransport/gRPC | ✅ | 高 | 高并发、真流式 | 过重，单机不推荐 |

---

## 5. 风险与前置确认

1. **成本**：`qwen-vl-max`、万相生图、ASR 均为按量计费，比纯文本贵数倍，需确认预算。
2. **视频未纳入本方案**：抽帧+音频双链路复杂度高、成本高，建议三阶段稳定后再单独评估。
3. **生图/ASR 协议**：通义万相与 ASR 走 DashScope **原生 API**（非 OpenAI `compatible-mode` 协议），需用 `dashscope` SDK 或 HTTP 直连，是相对独立的集成点。