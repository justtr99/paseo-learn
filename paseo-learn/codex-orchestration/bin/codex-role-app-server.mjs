#!/usr/bin/env node

// Windows-native counterpart of codex-role-app-server. The installer selects
// this Node launcher on win32, avoiding a Bash/WSL dependency.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = "codex";
const args = process.argv.slice(2);
const codexHome = path.resolve(process.env.CODEX_HOME || path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex"));
const agentId = process.env.PASEO_AGENT_ID;
const agentCwd = process.env.PASEO_AGENT_CWD;
const scoped = Boolean(agentId && agentCwd);
const workspace = path.resolve(scoped ? agentCwd : process.cwd());
const access = process.env.PASEO_MCP_ACCESS || "";
const codexArgs = [];

function fail(message, code = 2) {
	console.error(`codex-role-app-server: ${message}`);
	process.exit(code);
}

function isWithin(root, candidate) {
	const relative = path.relative(root, candidate);
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

if (!existsSync(codexHome) || !statSync(codexHome).isDirectory()) {
	fail(`CODEX_HOME does not exist: ${codexHome}`);
}
if (scoped && (isWithin(codexHome, workspace) || isWithin(workspace, codexHome))) {
	fail(`workspace and CODEX_HOME must not overlap (workspace=${workspace}, CODEX_HOME=${codexHome})`);
}

if (access === "lead" || access === "supervisor") {
	if (scoped) {
		if (!/^[A-Za-z0-9_-]+$/.test(agentId)) fail("invalid PASEO_AGENT_ID");
		const baseUrl = process.env.PASEO_MCP_BASE_URL || "http://127.0.0.1:6767/mcp/agents";
		const url = `${baseUrl}?callerAgentId=${agentId}`;
		codexArgs.push("-c", `mcp_servers.paseo.url=${JSON.stringify(url)}`, "-c", "mcp_servers.paseo.required=true");
		if (process.env.PASEO_MCP_BEARER_TOKEN) {
			codexArgs.push("-c", 'mcp_servers.paseo.bearer_token_env_var="PASEO_MCP_BEARER_TOKEN"');
		}
		if (access === "supervisor") {
			codexArgs.push("-c", 'mcp_servers.paseo.enabled_tools=["create_agent","send_agent_prompt","get_agent_status","list_agents","get_agent_activity"]');
		}
	}
} else if (access !== "") {
	fail("unsupported PASEO_MCP_ACCESS role");
}

const result = spawnSync(command, [...codexArgs, ...args], { stdio: "inherit" });
if (result.error) fail(`${command} is not on PATH`, 127);
process.exit(result.status ?? 1);
