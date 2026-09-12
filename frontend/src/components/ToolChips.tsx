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
  enabled: ToolKind[];
  onToggle: (kind: ToolKind) => void;
}

/**
 * 插拔式工具开关组：点击切换启用状态（只影响下一次任务），不再预填输入框。
 */
export function ToolChips({ enabled, onToggle }: ToolChipsProps) {
  const enabledSet = new Set(enabled);
  return (
    <div className="tool-chips" aria-label="启用工具">
      {TOOL_SHELF.map((tool) => {
        const checked = enabledSet.has(tool.kind);
        return (
          <button
            aria-pressed={checked}
            className={`tool-chip ${checked ? "tool-chip--active" : ""}`}
            key={tool.kind}
            onClick={() => onToggle(tool.kind)}
            title={checked ? `关闭「${tool.label}」` : `开启「${tool.label}」`}
            type="button"
          >
            {TOOL_ICONS[tool.kind]}
            <span>{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}