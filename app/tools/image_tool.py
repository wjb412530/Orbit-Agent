"""
图片理解工具

供主智能体读取用户上传的图片，并借助多模态模型（qwen-vl-max）理解图片内容。
工具先从 session_dir 读取图片文件，转 base64 后以多模态消息调用视觉模型，
返回对图片的理解文本，供后续分析或文档生成使用。
"""

import base64
from pathlib import Path
from typing import Annotated

from langchain_core.messages import HumanMessage
from langchain_core.tools import tool

from app.agent.llm import vl_model
from app.api.context import get_session_context
from app.api.monitor import monitor
from app.utils.path_utils import resolve_path

# 支持理解的图片扩展名及其 MIME 类型，转 data URL 时按 MIME 标注
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

_IMAGE_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
}


@tool
def analyze_image(
    filename: Annotated[
        str, "要分析的图片文件名（例如：photo.png），不要带目录前缀"
    ],
    instruction: Annotated[
        str, "对图片的分析指令（例如：描述图中内容、识别文字、总结图表数据）"
    ] = "描述这张图片的内容",
) -> str:
    """
    读取当前会话中用户上传的图片，并让多模态模型理解图片内容

    适用于：识别图片中的物体、文字、场景；根据图片回答问题；总结图表信息等。
    :param filename: 图片文件名，直接传文件名即可（不要带目录前缀）
    :param instruction: 模型需要完成的图片分析任务描述
    :return: 模型对图片的理解描述文本
    """
    monitor.report_tool("图片理解工具", {"filename": filename, "instruction": instruction})

    session_dir = get_session_context()
    file_path = Path(resolve_path(filename, session_dir))

    if not file_path.exists():
        return f"错误：图片 '{filename}' 不存在。"

    ext = file_path.suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        return f"错误：'{filename}' 不是支持的图片格式（支持 {', '.join(sorted(IMAGE_EXTENSIONS))}）。"

    mime = _IMAGE_MIME[ext]
    try:
        data = file_path.read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
    except Exception as e:
        return f"读取图片失败: {str(e)}"

    # 以多模态消息把图片（data URL）与指令一起交给视觉模型
    content = [
        {"type": "text", "text": instruction},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
    ]

    try:
        result = vl_model.invoke([HumanMessage(content=content)])
        text = result.content if isinstance(result.content, str) else str(result.content)
        return text
    except Exception as e:
        return f"图片理解失败: {str(e)}"