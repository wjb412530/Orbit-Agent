const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/opus": "webm"
};

export function extensionForAudioMime(mime: string): string {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  return AUDIO_MIME_EXTENSIONS[base] ?? "webm";
}

export function makeAudioFile(chunks: Blob[], mime: string, name?: string): File {
  const ext = extensionForAudioMime(mime);
  const filename = name ?? `录音.${ext}`;
  return new File(chunks, filename, { type: mime });
}

export function formatMediaDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}