import { describe, expect, it } from "vitest";
import {
  extensionForAudioMime,
  formatMediaDuration,
  makeAudioFile
} from "./audioRecording";

describe("extensionForAudioMime", () => {
  it("maps common audio MIME types to file extensions", () => {
    expect(extensionForAudioMime("audio/webm")).toBe("webm");
    expect(extensionForAudioMime("audio/mpeg")).toBe("mp3");
    expect(extensionForAudioMime("audio/wav")).toBe("wav");
    expect(extensionForAudioMime("audio/mp4")).toBe("m4a");
    expect(extensionForAudioMime("audio/ogg")).toBe("ogg");
    expect(extensionForAudioMime("audio/flac")).toBe("flac");
  });

  it("falls back to webm for unknown or empty MIME", () => {
    expect(extensionForAudioMime("")).toBe("webm");
    expect(extensionForAudioMime("video/mp4")).toBe("webm");
  });
});

describe("makeAudioFile", () => {
  it("builds a File with the given name and MIME type", () => {
    const file = makeAudioFile([new Blob(["x"])], "audio/webm", "面试录音");
    expect(file.name).toBe("面试录音");
    expect(file.type).toBe("audio/webm");
  });

  it("derives a default filename from the MIME extension", () => {
    const file = makeAudioFile([new Blob(["x"])], "audio/mpeg");
    expect(file.name).toBe("录音.mp3");
  });
});

describe("formatMediaDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatMediaDuration(0)).toBe("00:00");
    expect(formatMediaDuration(65000)).toBe("01:05");
    expect(formatMediaDuration(59000)).toBe("00:59");
  });

  it("includes hours when the recording exceeds one hour", () => {
    expect(formatMediaDuration(3661000)).toBe("1:01:01");
  });

  it("clamps negative values to zero", () => {
    expect(formatMediaDuration(-5000)).toBe("00:00");
  });
});