import {
  AudioOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  PlayCircleOutlined,
  SendOutlined,
  StopOutlined
} from "@ant-design/icons";
import { Button, Tooltip, Upload } from "antd";
import type { UploadFile } from "antd";
import { useEffect, useRef } from "react";
import { formatMediaDuration } from "../lib/audioRecording";
import { useMediaInput } from "../hooks/useMediaInput";
import type { UploadedItem } from "../types";

interface ChatComposerProps {
  autoFocusToken?: number;
  isCancelling: boolean;
  isRunning: boolean;
  isUploading: boolean;
  onCancel: () => void;
  onError: (message: string) => void;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestedPrompt: (prompt: string) => void;
  onUpload: (items: UploadedItem[]) => Promise<void> | void;
  onRemoveFile: (filename: string) => void;
  query: string;
  uploadedItems: UploadedItem[];
}

function extractFiles(info: { fileList: UploadFile[]; file: UploadFile }): File[] {
  const entries = info.fileList.length > 0 ? info.fileList : [info.file];
  const files: File[] = [];
  entries.forEach((entry) => {
    if (entry.originFileObj) {
      files.push(entry.originFileObj);
    }
  });
  return files;
}

export function ChatComposer({
  autoFocusToken = 0,
  isCancelling,
  isRunning,
  isUploading,
  onCancel,
  onError,
  onQueryChange,
  onRemoveFile,
  onSubmit,
  onSuggestedPrompt,
  onUpload,
  query,
  uploadedItems
}: ChatComposerProps) {
  const canSubmit = query.trim().length > 0 || uploadedItems.length > 0;
  const media = useMediaInput({ onUpload, onSuggestedPrompt, onError, onRemoveFile });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocusToken > 0) {
      textareaRef.current?.focus();
    }
  }, [autoFocusToken]);

  return (
    <section className="chat-composer" aria-label="发送研搜任务">
      {media.previews.length > 0 ? (
        <div className="media-previews">
          {media.previews.map((preview) => (
            <div
              className={`media-preview ${preview.kind === "audio" ? "media-preview--audio" : ""}`}
              key={preview.id}
            >
              {preview.kind === "image" && preview.objectUrl ? (
                <img src={preview.objectUrl} alt={preview.name} />
              ) : (
                <AudioOutlined aria-hidden />
              )}
              <span className="media-preview-name">{preview.name}</span>
              <Tooltip title="移除">
                <Button
                  aria-label="移除"
                  className="media-preview-remove"
                  icon={<DeleteOutlined />}
                  onClick={() => media.clearPreview(preview.id)}
                  shape="circle"
                  size="small"
                />
              </Tooltip>
            </div>
          ))}
        </div>
      ) : null}

      {uploadedItems.length > 0 ? (
        <div className="attachment-strip" aria-label="当前会话附件">
          {uploadedItems.map((item) => (
            <span className="attachment-pill" key={`${item.uid}-${item.name}`}>
              <PaperClipOutlined aria-hidden />
              {item.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="composer-shell">
        <textarea
          aria-label="研搜任务"
          disabled={isRunning}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="向 Orbit Agent 发送任务..."
          ref={textareaRef}
          value={query}
        />

        <div className="composer-toolbar">
          <div className="composer-left-actions">
            <Upload
              accept={media.accept}
              beforeUpload={() => false}
              fileList={[]}
              multiple
              onChange={(info) => media.handleAttachment(extractFiles(info))}
              showUploadList={false}
            >
              <Tooltip title="选择附件">
                <Button
                  aria-label="选择附件"
                  className="composer-icon-button"
                  disabled={isRunning || isUploading}
                  icon={<PaperClipOutlined />}
                  shape="circle"
                />
              </Tooltip>
            </Upload>
          </div>

          <div className="composer-right-actions">
            {media.recording ? (
              <span className="media-recording" aria-live="polite">
                <i aria-hidden />
                {formatMediaDuration(media.recordingSeconds * 1000)}
              </span>
            ) : null}
            <Tooltip title={media.recording ? "停止录音" : "录音"}>
              <Button
                aria-label={media.recording ? "停止录音" : "录音"}
                className={media.recording ? "composer-icon-button recorder-button--recording" : "composer-icon-button"}
                disabled={isRunning}
                icon={media.recording ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={() => void media.toggleRecording()}
                shape="circle"
              />
            </Tooltip>
            <Tooltip title={isRunning ? "取消当前任务" : "发送任务"}>
              <Button
                aria-label={isRunning ? "取消当前任务" : "发送任务"}
                className={isRunning ? "send-button send-button--cancel" : "send-button"}
                disabled={isRunning ? isCancelling : !canSubmit}
                icon={isRunning ? <StopOutlined /> : <SendOutlined />}
                loading={isCancelling}
                onClick={isRunning ? onCancel : onSubmit}
                shape="circle"
                type="primary"
              />
            </Tooltip>
          </div>
        </div>
      </div>
    </section>
  );
}