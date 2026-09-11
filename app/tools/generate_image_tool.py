"""
图片生成工具

供主智能体根据文本描述生成图片（文生图）。工具调用通义千问 qwen-image-3.0
文生图 API，把返回的图片保存到当前会话目录的 images/ 子目录，并返回图片路径，
供后续交付或前端展示。
"""

import base64
import os
import time
from pathlib import Path
from typing import Annotated

import requests
from langchain_core.tools import tool

from app.api.context import get_session_context
from app.api.monitor import monitor

# DashScope 文生图同步接口（华北2北京地域），可用环境变量覆盖地域或其他端点
DASHSCOPE_IMAGE_URL = os.getenv(
    "DASHSCOPE_IMAGE_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
)
QWEN_IMAGE_MODEL = os.getenv("QWEN_IMAGE_MODEL", "qwen-image-3.0")


def _save_image(image_ref: str, target_dir: Path, index: int) -> str:
    """把 base64 data URL 或公网 URL 的图片保存为本地文件，返回文件名"""
    if image_ref.startswith("data:"):
        # base64 data URL 形式：data:image/png;base64,xxxx
        header, encoded = image_ref.split(",", 1)
        if "image/jpeg" in header:
            ext = ".jpg"
        elif "image/webp" in header:
            ext = ".webp"
        else:
            ext = ".png"
        data = base64.b64decode(encoded)
        filename = f"generated_{int(time.time())}_{index}{ext}"
        (target_dir / filename).write_bytes(data)
        return filename

    # 公网 URL 形式：下载后保存
    filename = f"generated_{int(time.time())}_{index}.png"
    resp = requests.get(image_ref, timeout=60)
    resp.raise_for_status()
    (target_dir / filename).write_bytes(resp.content)
    return filename


@tool
def generate_image(
    prompt: Annotated[
        str, "生成图片的文本描述，尽量详细描述内容、风格、构图等要素"
    ],
    size: Annotated[
        str,
        "图片尺寸（宽*高像素，如 1024*1024），总像素需在 512*512 到 2048*2048 之间",
    ] = "1024*1024",
) -> str:
    """
    根据文本描述生成图片（文生图）

    适用于用户要求生成插画、海报、示意图、配图等图片。调用通义千问 qwen-image-3.0
    模型生成图片并保存到当前会话目录的 images/ 子目录。
    :param prompt: 生成图片的详细文本描述
    :param size: 图片尺寸，格式为"宽*高"，如 1024*1024
    :return: 图片保存结果说明与相对路径
    """
    monitor.report_tool("图片生成工具", {"prompt": prompt, "size": size})

    session_dir = get_session_context()
    image_dir = Path(session_dir) / "images"
    image_dir.mkdir(parents=True, exist_ok=True)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "错误：未配置 OPENAI_API_KEY，无法调用文生图服务。"

    payload = {
        "model": QWEN_IMAGE_MODEL,
        "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
        "parameters": {"size": size},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(DASHSCOPE_IMAGE_URL, headers=headers, json=payload, timeout=180)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return f"调用文生图服务失败: {str(e)}"

    # 解析返回的图片（base64 data URL 或临时公网 URL）
    images = []
    choices = data.get("output", {}).get("choices", [])
    for choice in choices:
        content = choice.get("message", {}).get("content", [])
        for item in content:
            img = item.get("image")
            if img:
                images.append(img)

    if not images:
        return f"文生图服务未返回图片，原始响应：{str(data)[:300]}"

    saved = []
    for i, img in enumerate(images):
        try:
            filename = _save_image(img, image_dir, i)
            saved.append(f"images/{filename}")
        except Exception as e:
            saved.append(f"(第{i + 1}张保存失败: {str(e)})")

    return f"已生成 {len(images)} 张图片，保存在当前会话目录：{', '.join(saved)}。"