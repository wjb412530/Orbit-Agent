import { describe, expect, it } from "vitest";
import {
  buildAudioPrompt,
  buildImagePrompt,
  buildMediaPrompt,
  categorizeMedia,
  isAudioName,
  isImageName
} from "./media";

describe("categorizeMedia", () => {
  it("classifies image extensions case-insensitively", () => {
    expect(categorizeMedia("photo.PNG")).toBe("image");
    expect(categorizeMedia("photo.jpg")).toBe("image");
    expect(categorizeMedia("t.webp")).toBe("image");
    expect(categorizeMedia("t.gif")).toBe("image");
    expect(categorizeMedia("t.bmp")).toBe("image");
  });

  it("classifies audio extensions case-insensitively", () => {
    expect(categorizeMedia("meeting.mp3")).toBe("audio");
    expect(categorizeMedia("rec.WAV")).toBe("audio");
    expect(categorizeMedia("rec.m4a")).toBe("audio");
    expect(categorizeMedia("rec.flac")).toBe("audio");
    expect(categorizeMedia("rec.webm")).toBe("audio");
  });

  it("classifies document extensions", () => {
    expect(categorizeMedia("report.pdf")).toBe("document");
    expect(categorizeMedia("sheet.xlsx")).toBe("document");
    expect(categorizeMedia("data.csv")).toBe("document");
    expect(categorizeMedia("notes.txt")).toBe("document");
    expect(categorizeMedia("readme.md")).toBe("document");
  });

  it("returns other for unknown or missing extensions", () => {
    expect(categorizeMedia("archive.zip")).toBe("other");
    expect(categorizeMedia("noextension")).toBe("other");
    expect(categorizeMedia("")).toBe("other");
  });
});

describe("isImageName / isAudioName", () => {
  it("detects image and audio names", () => {
    expect(isImageName("a.png")).toBe(true);
    expect(isImageName("a.mp3")).toBe(false);
    expect(isAudioName("a.wav")).toBe(true);
    expect(isAudioName("a.pdf")).toBe(false);
  });
});

describe("prompt builders", () => {
  it("builds a default image-analysis prompt", () => {
    expect(buildImagePrompt()).toBe("请分析这张图片的内容。");
  });

  it("builds an image-analysis prompt with instruction", () => {
    expect(buildImagePrompt("识别图中的文字")).toBe("请分析这张图片：识别图中的文字");
  });

  it("builds a default audio-transcription prompt", () => {
    expect(buildAudioPrompt()).toBe("请转写这段音频，并总结要点。");
  });

  it("builds an audio-transcription prompt with instruction", () => {
    expect(buildAudioPrompt("整理成会议纪要")).toBe("请转写这段音频：整理成会议纪要");
  });
});

describe("buildMediaPrompt", () => {
  it("builds an image prompt for image-only attachments", () => {
    expect(buildMediaPrompt([{ name: "photo.png" }, { name: "logo.JPG" }])).toBe(
      "请分析这张图片的内容。"
    );
  });

  it("builds a transcription prompt for audio-only attachments", () => {
    expect(buildMediaPrompt([{ name: "meeting.mp3" }])).toBe("请转写这段音频，并总结要点。");
  });

  it("builds a combined prompt for mixed media attachments", () => {
    expect(buildMediaPrompt([{ name: "a.png" }, { name: "b.wav" }])).toBe(
      "请分析我上传的图片，并转写我上传的音频。"
    );
  });

  it("returns an empty string when no media files are attached", () => {
    expect(buildMediaPrompt([{ name: "report.pdf" }, { name: "data.csv" }])).toBe("");
    expect(buildMediaPrompt([])).toBe("");
  });
});