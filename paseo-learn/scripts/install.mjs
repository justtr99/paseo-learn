#!/usr/bin/env node

/**
 * Cross-platform dispatcher for the Paseo Learn role-pack installers.
 * Bash, PowerShell, and CMD wrappers all forward to this file so they keep
 * identical argument handling and install order.
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flags = [];
let target = "";

function usage() {
	console.log(`Usage:
  ./install [codex|pi|claude|all] [--dry-run] [--force]
  .\\install.ps1 [codex|pi|claude|all] [--dry-run] [--force]
  install.cmd [codex|pi|claude|all] [--dry-run] [--force]

Targets:
  codex   Install the Codex role pack only.
  pi      Install the Pi role pack only.
  claude  Install the Claude Code role pack only.
  all     Install all three (Codex, Pi, then Claude). Stops on first failure.
  (none)  Interactive prompt.

Flags:
  --dry-run   Preview every change; write nothing.
  --force     Overwrite files that differ (backs them up first).
  -h, --help  Show this help.`);
}

for (const arg of argv) {
	if (arg === "-h" || arg === "--help") {
		usage();
		process.exit(0);
	}
	if (arg === "--dry-run" || arg === "--force") {
		flags.push(arg);
		continue;
	}
	if (arg.startsWith("-")) {
		console.error(`install: unknown flag ${arg}`);
		usage();
		process.exit(2);
	}
	if (target) {
		console.error(`install: unexpected extra argument '${arg}'`);
		process.exit(2);
	}
	target = arg;
}

if (!target) {
	if (!input.isTTY) {
		console.error("install: target is required when standard input is not interactive");
		usage();
		process.exit(2);
	}
	const rl = createInterface({ input, output });
	try {
		const answer = (await rl.question("Choose a pack (codex, pi, claude, all): ")).trim().toLowerCase();
		target = answer;
	} finally {
		rl.close();
	}
}

const installers = {
	codex: path.join(repoRoot, "codex-orchestration", "install.mjs"),
	pi: path.join(repoRoot, "pi-orchestration", "install.mjs"),
	claude: path.join(repoRoot, "claude-orchestration", "install.mjs"),
};
const packs = target === "all" ? ["codex", "pi", "claude"] : [target];

if (!packs.every((pack) => Object.hasOwn(installers, pack))) {
	console.error("install: unknown target (use codex|pi|claude|all)");
	usage();
	process.exit(2);
}

for (const pack of packs) {
	console.log(`\n▶ Installing ${pack} role pack`);
	const result = spawnSync(process.execPath, [installers[pack], ...flags], {
		cwd: repoRoot,
		stdio: "inherit",
	});
	if (result.error) {
		console.error(`install: could not start ${pack} installer: ${result.error.message}`);
		process.exit(1);
	}
	if (result.status !== 0) {
		console.error(`install: ${pack} installer failed; later packs were not run.`);
		process.exit(result.status ?? 1);
	}
}

if (!flags.includes("--dry-run")) {
	console.log("\nPaseo daemon was NOT restarted. Finish active agents, then restart it manually.");
}
