import {
  CloudServerOutlined,
  DatabaseOutlined,
  FilePdfOutlined,
  FileSearchOutlined
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { TOOL_SHELF, type ToolKind } from "../lib/toolShelf";

const TOOL_ICONS: Record<ToolKind, ReactNode> = {
  network: <CloudServerOutlined aria-hidden />,
  database: <DatabaseOutlined aria-hidden />,
  ragflow: <FileSearchOutlined aria-hidden />,
  pdf: <FilePdfOutlined aria-hidden />
};

interface ToolChipsProps {
  onUseTool: (prompt: string) => void;
}

export function ToolChips({ onUseTool }: ToolChipsProps) {
  return (
    <div className="tool-chips" aria-label="可用工具">
      {TOOL_SHELF.map((tool) => (
        <button
          className="tool-chip"
          key={tool.kind}
          onClick={() => onUseTool(tool.prompt)}
          title={`使用「${tool.label}」预填任务`}
          type="button"
        >
          {TOOL_ICONS[tool.kind]}
          <span>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}