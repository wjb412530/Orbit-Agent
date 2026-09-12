"""resolve_agent_config 纯函数的单元测试（TDD）。"""

import unittest

from app.agent.agent_config import (
    ALLOWED_TOOL_KINDS,
    BASE_TOOLS,
    PDF_TOOLS,
    resolve_agent_config,
)


class ResolveAgentConfigTests(unittest.TestCase):
    def test_empty_set_returns_only_base_tools_and_no_subagents(self):
        tools, subagents = resolve_agent_config(frozenset())

        self.assertEqual(tools, list(BASE_TOOLS))
        self.assertEqual(subagents, [])

    def test_single_retrieval_kind_maps_to_exact_subagent(self):
        expected_names = {
            "network": "网络搜索助手",
            "database": "数据库查询助手",
            "ragflow": "RAGFlow助手",
        }
        for kind, expected_name in expected_names.items():
            tools, subagents = resolve_agent_config(frozenset({kind}))
            self.assertEqual(len(subagents), 1, kind)
            self.assertEqual(subagents[0]["name"], expected_name, kind)
            # 检索类开关不得引入交付工具
            self.assertNotIn(PDF_TOOLS[0], tools, kind)
            self.assertEqual(tools, list(BASE_TOOLS), kind)

    def test_pdf_switch_adds_both_delivery_tools(self):
        tools, subagents = resolve_agent_config(frozenset({"pdf"}))

        for pdf_tool in PDF_TOOLS:
            self.assertIn(pdf_tool, tools)
        self.assertEqual(subagents, [])

    def test_combination_registers_subagents_and_pdf_tools(self):
        tools, subagents = resolve_agent_config(frozenset({"network", "pdf"}))

        self.assertEqual([agent["name"] for agent in subagents], ["网络搜索助手"])
        for pdf_tool in PDF_TOOLS:
            self.assertIn(pdf_tool, tools)
        for base_tool in BASE_TOOLS:
            self.assertIn(base_tool, tools)

    def test_all_kinds_registers_everything(self):
        tools, subagents = resolve_agent_config(frozenset(ALLOWED_TOOL_KINDS))

        self.assertEqual(
            [agent["name"] for agent in subagents],
            ["网络搜索助手", "数据库查询助手", "RAGFlow助手"],
        )
        for pdf_tool in PDF_TOOLS:
            self.assertIn(pdf_tool, tools)

    def test_unknown_kinds_are_filtered_out(self):
        tools, subagents = resolve_agent_config(frozenset({"network", "hacker"}))

        self.assertEqual([agent["name"] for agent in subagents], ["网络搜索助手"])
        self.assertEqual(tools, list(BASE_TOOLS))

    def test_base_tools_never_dropped_by_pdf_switch(self):
        tools, _ = resolve_agent_config(frozenset({"pdf"}))

        for base_tool in BASE_TOOLS:
            self.assertIn(base_tool, tools)


if __name__ == "__main__":
    unittest.main()