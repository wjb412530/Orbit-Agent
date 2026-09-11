import { useCallback, useEffect, useRef, useState } from "react";
import { formatMediaDuration, makeAudioFile } from "../lib/audioRecording";
import {
  buildAudioPrompt,
  buildImagePrompt,
  isAudioName,
  isImageName
} from "../lib/media";
import type { UploadedItem } from "../types";

export interface MediaPreview {
  id: string;
  kind: "image" | "audio";
  name: string;
  filename: string;
  objectUrl?: string;
}

interface UseMediaInputOptions {
  onUpload: (items: UploadedItem[]) => void;
  onSuggestedPrompt: (prompt: string) => void;
  onError: (message: string) => void;
  onRemoveFile: (filename: string) => void;
}

const ATTACH_ACCEPT =
  ".txt,.md,.pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,.bmp,.mp3,.wav,.m4a,.aac,.flac,.ogg,.amr,.webm";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toItem(file: File): UploadedItem {
  return {
    uid: makeId(),
    name: file.name,
    size: file.size,
    raw: file
  };
}

export function useMediaInput({ onUpload, onSuggestedPrompt, onError, onRemoveFile }: UseMediaInputOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("audio/webm");
  const timerRef = useRef<number | undefined>(undefined);
  const secondsRef = useRef(0);
  const objectUrlsRef = useRef<string[]>([]);

  const [previews, setPreviews] = useState<MediaPreview[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [stopTimer]);

  const clearPreview = useCallback(
    (id: string) => {
      const target = previews.find((preview) => preview.id === id);
      if (target?.objectUrl) {
        URL.revokeObjectURL(target.objectUrl);
        objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== target.objectUrl);
      }
      if (target) {
        onRemoveFile(target.filename);
      }
      setPreviews((previous) => previous.filter((preview) => preview.id !== id));
    },
    [previews, onRemoveFile]
  );

  const handleAttachment = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      onUpload(files.map(toItem));

      const nextPreviews: MediaPreview[] = [];
      files.forEach((file) => {
        if (isImageName(file.name)) {
          const url = URL.createObjectURL(file);
          objectUrlsRef.current.push(url);
          nextPreviews.push({
            id: makeId(),
            kind: "image",
            name: file.name,
            filename: file.name,
            objectUrl: url
          });
        } else if (isAudioName(file.name)) {
          nextPreviews.push({ id: makeId(), kind: "audio", name: file.name, filename: file.name });
        }
      });

      if (nextPreviews.length > 0) {
        setPreviews((previous) => [...previous, ...nextPreviews]);
      }

      if (files.length === 1) {
        if (isImageName(files[0].name)) {
          onSuggestedPrompt(buildImagePrompt());
        } else if (isAudioName(files[0].name)) {
          onSuggestedPrompt(buildAudioPrompt());
        }
      }
    },
    [onUpload, onSuggestedPrompt]
  );

  const finishRecording = useCallback(() => {
    stopTimer();
    const file = makeAudioFile(chunksRef.current, mimeRef.current);
    const title = `${file.name} · ${formatMediaDuration(secondsRef.current * 1000)}`;
    setPreviews((previous) => [
      ...previous,
      { id: makeId(), kind: "audio", name: title, filename: file.name }
    ]);
    onUpload([toItem(file)]);
    onSuggestedPrompt(buildAudioPrompt());
    setRecording(false);
    setRecordingSeconds(0);
    secondsRef.current = 0;
  }, [onSuggestedPrompt, onUpload, stopTimer]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onError("当前浏览器不支持麦克风录音");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime =
        ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"].find((type) =>
          MediaRecorder.isTypeSupported(type)
        ) || "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      chunksRef.current = [];
      mimeRef.current = preferredMime;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        finishRecording();
      };

      recorder.start();
      recorderRef.current = recorder;
      secondsRef.current = 0;
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
      }, 1000);
    } catch {
      onError("无法访问麦克风，请检查浏览器权限");
    }
  }, [recording, finishRecording, onError]);

  return {
    accept: ATTACH_ACCEPT,
    previews,
    recording,
    recordingSeconds,
    handleAttachment,
    toggleRecording,
    clearPreview
  };
}