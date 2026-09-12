"""
主智能体能力装配纯函数模块

把「前端插拔开关 -> 实际注册的工具与子智能体」的映射逻辑集中于此，
便于 main_agent 复用与单元测试。四个开关：
- network  -> 网络搜索助手
- database -> 数据库查询助手
- ragflow  -> RAGFlow 助手
- pdf      -> generate_markdown + convert_md_to_pdf 交付工具

基础工具（读附件、看图、生成图片、音频转写）始终可用，不受开关管控。
"""

from app.agent.prompts import main_agent_content
from app.agent.subagents.database_query_agent import database_query_agent
from app.agent.subagents.knowledge_base_agent import knowledge_base_agent
from app.agent.subagents.network_search_agent import network_search_agent
from app.tools.generate_image_tool import generate_image
from app.tools.image_tool import analyze_image
from app.tools.markdown_tools import generate_markdown
from app.tools.pdf_tools import convert_md_to_pdf
from app.tools.transcribe_audio_tool import transcribe_audio
from app.tools.upload_file_read_tool import read_file_content

ALLOWED_TOOL_KINDS = {"network", "database", "ragflow", "pdf"}

# 检索类开关 -> 字典式子智能体；主智能体按是否在启停清单中决定是否注册
SUBAGENT_BY_KIND = {
    "network": network_search_agent,
    "database": database_query_agent,
    "ragflow": knowledge_base_agent,
}

# 基础工具始终注册；pdf 开关额外追加两个交付工具
BASE_TOOLS = [read_file_content, analyze_image, generate_image, transcribe_audio]
PDF_TOOLS = [generate_markdown, convert_md_to_pdf]

# 动态提示段里使用的中文能力名
KIND_LABELS = {
    "network": "网络搜索助手",
    "database": "数据库查询助手",
    "ragflow": "RAGFlow助手",
}

# 检索开关的固定展示顺序，保证 subagents 列表顺序稳定
RETRIEVAL_KINDS = ("network", "database", "ragflow")


def resolve_agent_config(enabled):
    """按启停清单真裁剪 (tools, subagents)。

    :param enabled: frozenset[str]，合法值见 ALLOWED_TOOL_KINDS，非法值会被静默过滤
    :return: (tools: list, subagents: list)
    """
    kinds = frozenset(enabled) & ALLOWED_TOOL_KINDS

    tools = list(BASE_TOOLS)
    if "pdf" in kinds:
        tools.extend(PDF_TOOLS)

    subagents = [SUBAGENT_BY_KIND[kind] for kind in RETRIEVAL_KINDS if kind in kinds]

    return tools, subagents


def build_system_prompt(enabled):
    """在主提示词尾部动态注入「本次可用能力」，与真裁剪保持一致。

    由于 agent 实例按启停组合缓存，同一组合内的提示词完全一致，不影响缓存语义。
    """
    kinds = frozenset(enabled) & ALLOWED_TOOL_KINDS

    enabled_retrieval = [KIND_LABELS[kind] for kind in RETRIEVAL_KINDS if kind in kinds]
    if enabled_retrieval:
        abilities = [
            "本次任务启用的信息检索助手：" + "、".join(enabled_retrieval) + "。"
        ]
    else:
        abilities = [
            "本次任务未启用任何信息检索助手：请基于自身知识与用户上传的文件作答，"
            "涉及事实性内容时需向用户说明信息来源局限。"
        ]

    if "pdf" in kinds:
        abilities.append(
            "本次任务已启用文件生成工具（generate_markdown / convert_md_to_pdf），"
            "可按用户要求生成 Markdown / PDF 交付物。"
        )
    else:
        abilities.append(
            "本次任务未启用文件生成工具：不得调用 generate_markdown / convert_md_to_pdf；"
            "若用户要求生成文件，需说明本次未开启该工具。"
        )

    abilities.append("除以上列出的能力外，不得尝试调用任何未启用的助手或工具。")

    return main_agent_content["system_prompt"] + "\n\n【本次可用能力】\n" + "\n".join(abilities)