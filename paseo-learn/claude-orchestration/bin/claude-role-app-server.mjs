#!/usr/bin/env node

// Windows-native counterpart of claude-role-app-server. It injects the same
// agent-scoped Paseo MCP configuration as the POSIX launcher.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = "claude";
const args = process.argv.slice(2);
const agentDir = path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(process.env.USERPROFILE || process.env.HOME || "", ".claude"));
const agentId = process.env.PASEO_AGENT_ID;
const agentCwd = process.env.PASEO_AGENT_CWD;
const scoped = Boolean(agentId && agentCwd);
const workspace = path.resolve(scoped ? agentCwd : process.cwd());
const access = process.env.PASEO_MCP_ACCESS || "";
const claudeArgs = [];

function fail(message, code = 2) {
	console.error(`claude-role-app-server: ${message}`);
	process.exit(code);
}

function isWithin(root, candidate) {
	const relative = path.relative(root, candidate);
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

if (!existsSync(agentDir) || !statSync(agentDir).isDirectory()) {
	fail(`CLAUDE_CONFIG_DIR does not exist: ${agentDir}`);
}
if (scoped && (isWithin(agentDir, workspace) || isWithin(workspace, agentDir))) {
	fail(`workspace and CLAUDE_CONFIG_DIR must not overlap (workspace=${workspace}, agent_dir=${agentDir})`);
}

if (access === "lead" || access === "supervisor") {
	if (scoped) {
		if (!/^[A-Za-z0-9_-]+$/.test(agentId)) fail("invalid PASEO_AGENT_ID");
		const baseUrl = process.env.PASEO_MCP_BASE_URL || "http://127.0.0.1:6767/mcp/agents";
		const url = `${baseUrl}?callerAgentId=${agentId}`;
		const paseo = { type: "http", url, lifecycle: "lazy" };
		if (process.env.PASEO_MCP_BEARER_TOKEN) {
			paseo.headers = { Authorization: "Bearer ${PASEO_MCP_BEARER_TOKEN}" };
		}
		claudeArgs.push("--mcp-config", JSON.stringify({ mcpServers: { paseo } }));
	}
} else if (access !== "") {
	fail("unsupported PASEO_MCP_ACCESS role");
}

const result = spawnSync(command, [...claudeArgs, ...args], { stdio: "inherit" });
if (result.error) fail(`${command} is not on PATH`, 127);
process.exit(result.status ?? 1);
