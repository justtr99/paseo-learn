#!/usr/bin/env node

// Windows-native counterpart of pi-role-app-server. The role mcp.json reads
// PASEO_MCP_URL, so this launcher only derives that agent-scoped value.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = "pi";
const args = process.argv.slice(2);
const agentDir = path.resolve(process.env.PI_CODING_AGENT_DIR || path.join(process.env.USERPROFILE || process.env.HOME || "", ".pi", "agent"));
const agentId = process.env.PASEO_AGENT_ID;
const agentCwd = process.env.PASEO_AGENT_CWD;
const scoped = Boolean(agentId && agentCwd);
const workspace = path.resolve(scoped ? agentCwd : process.cwd());
const access = process.env.PASEO_MCP_ACCESS || "";

function fail(message, code = 2) {
	console.error(`pi-role-app-server: ${message}`);
	process.exit(code);
}

function isWithin(root, candidate) {
	const relative = path.relative(root, candidate);
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

if (!existsSync(agentDir) || !statSync(agentDir).isDirectory()) {
	fail(`PI_CODING_AGENT_DIR does not exist: ${agentDir}`);
}
if (scoped && (isWithin(agentDir, workspace) || isWithin(workspace, agentDir))) {
	fail(`workspace and PI_CODING_AGENT_DIR must not overlap (workspace=${workspace}, agent_dir=${agentDir})`);
}

if (access === "lead" || access === "supervisor") {
	if (scoped) {
		if (!/^[A-Za-z0-9_-]+$/.test(agentId)) fail("invalid PASEO_AGENT_ID");
		const baseUrl = process.env.PASEO_MCP_BASE_URL || "http://127.0.0.1:6767/mcp/agents";
		process.env.PASEO_MCP_URL = `${baseUrl}?callerAgentId=${agentId}`;
	}
} else if (access !== "") {
	fail("unsupported PASEO_MCP_ACCESS role");
}

const result = spawnSync(command, args, { stdio: "inherit" });
if (result.error) fail(`${command} is not on PATH`, 127);
process.exit(result.status ?? 1);
