export type MediaKind = "image" | "audio" | "document" | "other";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg", "amr", "webm"]);
const DOCUMENT_EXTENSIONS = new Set([
  "txt",
  "md",
  "pdf",
  "docx",
  "doc",
  "xlsx",
  "xls",
  "csv",
  "pptx",
  "ppt",
  "json",
  "xml",
  "html"
]);

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  if (index < 0 || index === name.length - 1) {
    return "";
  }
  return name.slice(index + 1).toLowerCase();
}

export function isImageName(name: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(name));
}

export function isAudioName(name: string): boolean {
  return AUDIO_EXTENSIONS.has(extensionOf(name));
}

export function categorizeMedia(name: string): MediaKind {
  const ext = extensionOf(name);
  if (IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    return "audio";
  }
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return "document";
  }
  return "other";
}

export function buildImagePrompt(instruction?: string): string {
  const base = "请分析这张图片";
  return instruction && instruction.trim() ? `${base}：${instruction.trim()}` : `${base}的内容。`;
}

export function buildAudioPrompt(instruction?: string): string {
  const base = "请转写这段音频";
  return instruction && instruction.trim() ? `${base}：${instruction.trim()}` : `${base}，并总结要点。`;
}

export function buildMediaPrompt(items: { name: string }[]): string {
  const hasImage = items.some((item) => isImageName(item.name));
  const hasAudio = items.some((item) => isAudioName(item.name));

  if (hasImage && hasAudio) {
    return "请分析我上传的图片，并转写我上传的音频。";
  }
  if (hasImage) {
    return buildImagePrompt();
  }
  if (hasAudio) {
    return buildAudioPrompt();
  }
  return "";
}