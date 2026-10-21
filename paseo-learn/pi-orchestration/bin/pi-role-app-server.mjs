#!/usr/bin/env node

// Windows-native counterpart of pi-role-app-server. The role mcp.json reads
// PASEO_MCP_URL, so this launcher only derives that agent-scoped value.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Paseo Desktop's daemon does not necessarily inherit the interactive
// PowerShell PATH. The installer pins the discovered Windows shim here so the
// role still starts when npm's global bin directory is absent from the daemon.
const configuredCommand = process.env.PASEO_PI_COMMAND?.trim();
const command = configuredCommand || resolveCommand("pi");
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

function resolveCommand(binary) {
	if (process.platform !== "win32") return binary;
	const extensions = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";");
	for (const directory of (process.env.PATH || "").split(path.delimiter)) {
		for (const extension of extensions) {
			const candidate = path.join(directory, `${binary}${extension}`);
			if (existsSync(candidate)) return candidate;
		}
	}
	return binary;
}

if (!existsSync(agentDir) || !statSync(agentDir).isDirectory()) {
	fail(`PI_CODING_AGENT_DIR does not exist: ${agentDir}`);
}
if (configuredCommand && !existsSync(command)) {
	fail(`configured Pi command does not exist: ${command}`, 127);
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

const result = spawnSync(command, args, {
	stdio: "inherit",
	// npm installs its Windows entry point as pi.cmd. Node can launch .exe
	// files directly, but a .cmd shim needs cmd.exe.
	shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command),
});
if (result.error) {
	fail(
		configuredCommand
			? `cannot start configured Pi command: ${command}`
			: `${command} is not on PATH`,
		127,
	);
}
process.exit(result.status ?? 1);
