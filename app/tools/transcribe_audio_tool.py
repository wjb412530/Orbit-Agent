"""
语音转写工具

供主智能体读取用户上传的音频文件，并调用通义千问 ASR 模型（qwen-audio-3.0-asr-flash）
把语音转写成文字，再将转写文本返回主智能体用于后续理解、分析与文档生成。
"""

import base64
import os
from pathlib import Path
from typing import Annotated

import requests
from langchain_core.tools import tool

from app.api.context import get_session_context
from app.api.monitor import monitor
from app.utils.path_utils import resolve_path

# DashScope 语音识别同步接口（华北2北京地域），可用环境变量覆盖
DASHSCOPE_ASR_URL = os.getenv(
    "DASHSCOPE_ASR_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
)
QWEN_ASR_MODEL = os.getenv("QWEN_ASR_MODEL", "qwen-audio-3.0-asr-flash")

# 支持的音频扩展名及对应 MIME 类型，用于构造 base64 data URL
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".amr", ".webm"}

_AUDIO_MIME = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".amr": "audio/amr",
    ".webm": "audio/webm",
}


@tool
def transcribe_audio(
    filename: Annotated[
        str, "要转写的音频文件名（例如：meeting.mp3），不要带目录前缀"
    ],
) -> str:
    """
    读取当前会话中用户上传的音频文件，并转写为文字

    适用于：把录音、语音消息等音频转成文本，供主智能体理解内容、回答问题或生成文档。
    :param filename: 音频文件名，直接传文件名即可（不要带目录前缀）
    :return: 音频转写得到的文本
    """
    monitor.report_tool("语音转写工具", {"filename": filename})

    session_dir = get_session_context()
    file_path = Path(resolve_path(filename, session_dir))

    if not file_path.exists():
        return f"错误：音频 '{filename}' 不存在。"

    ext = file_path.suffix.lower()
    if ext not in AUDIO_EXTENSIONS:
        return f"错误：'{filename}' 不是支持的音频格式（支持 {', '.join(sorted(AUDIO_EXTENSIONS))}）。"

    mime = _AUDIO_MIME[ext]
    try:
        # 音频文件做成 base64 data URL 交给 ASR 服务，无需上传到公网 OSS
        data = file_path.read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
    except Exception as e:
        return f"读取音频失败: {str(e)}"

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "错误：未配置 OPENAI_API_KEY，无法调用语音转写服务。"

    payload = {
        "model": QWEN_ASR_MODEL,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {"data": f"data:{mime};base64,{b64}"},
                        }
                    ],
                }
            ]
        },
        "parameters": {"format": ext.lstrip(".")},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-SSE": "disable",
    }

    try:
        resp = requests.post(DASHSCOPE_ASR_URL, headers=headers, json=payload, timeout=180)
        resp.raise_for_status()
        data_resp = resp.json()
    except Exception as e:
        return f"调用语音转写服务失败: {str(e)}"

    # 解析转写文本（output.choices[].message.content[].text）
    texts = []
    choices = data_resp.get("output", {}).get("choices", [])
    for choice in choices:
        content = choice.get("message", {}).get("content", [])
        for item in content:
            if isinstance(item, dict) and item.get("text"):
                texts.append(item["text"])

    text = "".join(texts).strip()
    if text:
        return text
    return f"语音转写未返回文字，原始响应：{str(data_resp)[:300]}"