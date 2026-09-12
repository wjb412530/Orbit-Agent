export type ToolKind = "network" | "database" | "ragflow" | "pdf";

export interface ToolSpec {
  kind: ToolKind;
  label: string;
  icon: string;
  prompt: string;
}

export const TOOL_SHELF: ToolSpec[] = [
  {
    kind: "network",
    label: "联网搜索",
    icon: "network",
    prompt:
      "请使用网络搜索工具，检索 2026 年跨境电商 AI 客服趋势，列出 5 条关键变化，并附上来源链接。"
  },
  {
    kind: "database",
    label: "数据库查询",
    icon: "database",
    prompt:
      "请使用数据库查询工具，查询库存大于 100 的药品，按库存量升序列出药品名称、批次号、仓库位置和过期日期。"
  },
  {
    kind: "ragflow",
    label: "RAGFlow 知识库",
    icon: "ragflow",
    prompt:
      "请使用 RAGFlow 助手，查询公司内部白皮书中关于品类策略的内容，并整理成三条可执行建议。"
  },
  {
    kind: "pdf",
    label: "PDF 报告",
    icon: "pdf",
    prompt:
      "请使用 Markdown 文档生成工具和 Markdown 转 PDF 工具，基于本次调研结果生成一份 Markdown 报告，并转换成 PDF 保存到当前工作目录。"
  }
];

export function getToolPrompt(kind: ToolKind): string {
  const spec = TOOL_SHELF.find((tool) => tool.kind === kind);
  if (!spec) {
    throw new Error(`Unknown tool kind: ${kind}`);
  }
  return spec.prompt;
}

export function composePrefill(_current: string, toolPrompt: string): string {
  return toolPrompt;
}