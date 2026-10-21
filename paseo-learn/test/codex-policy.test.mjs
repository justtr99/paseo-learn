import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseTaskBrief, workerGitAuthority } from "../codex-orchestration/shared/paseo-team-policy/brief.mjs";
import { blockReasonForTool, detectRole } from "../codex-orchestration/shared/paseo-team-policy/policy.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const engineer = parseTaskBrief(`PASEO_TEAM_TASK_V3_BEGIN\nTASK_ID: T-CODEX\nDISPOSITION: engineer\nMODE: write\nOWNED_SCOPE: codex-orchestration, test\nPASEO_TEAM_TASK_V3_END`);
assert.deepEqual(workerGitAuthority(engineer), { edit: true, commit: true, push: true, forcePush: false, merge: true, deploy: false });
const reviewer = parseTaskBrief(`PASEO_TEAM_TASK_V3_BEGIN\nTASK_ID: T-R\nDISPOSITION: reviewer\nMODE: read-only\nPASEO_TEAM_TASK_V3_END`);
assert.equal(workerGitAuthority(reviewer).edit, false);
const invalidReviewerWrite = parseTaskBrief(`PASEO_TEAM_TASK_V3_BEGIN\nTASK_ID: T-BAD\nDISPOSITION: reviewer\nMODE: write\nOWNED_SCOPE: test\nPASEO_TEAM_TASK_V3_END`);
assert.ok(invalidReviewerWrite.malformed.some((x) => x.includes("only for DISPOSITION: engineer")));
assert.equal(workerGitAuthority(invalidReviewerWrite).edit, false);

process.env.PASEO_CODEX_ROLE = "peer";
assert.equal(detectRole(), "peer");
assert.equal(blockReasonForTool("peer", engineer, "apply_patch", { command: "*** Begin Patch\n*** Update File: test/new.mjs\n*** End Patch" }, repo), null);
assert.match(blockReasonForTool("peer", reviewer, "apply_patch", { command: "*** Begin Patch\n*** Update File: test/new.mjs\n*** End Patch" }, repo), /read-only/);
assert.match(blockReasonForTool("peer", engineer, "apply_patch", { command: "*** Begin Patch\n*** Update File: README.md\n*** End Patch" }, repo), /outside OWNED_SCOPE/);
assert.match(blockReasonForTool("peer", engineer, "mcp__paseo__create_agent", {}, repo), /cannot use Paseo/);
assert.match(blockReasonForTool("peer", engineer, "Bash", { command: "git push --force" }, repo), /FORCE_PUSH_AUTHORITY/);

const home = mkdtempSync(path.join(tmpdir(), "paseo-codex-slp-"));
const codexHome = path.join(home, "codex");
mkdirSync(codexHome, { recursive: true });
writeFileSync(path.join(codexHome, "auth.json"), "fixture credential\n");
const install = spawnSync(process.execPath, [path.join(repo, "codex-orchestration", "install.mjs")], {
  env: { ...process.env, CODEX_HOME: codexHome, PASEO_HOME: path.join(home, "paseo"), PASEO_CODEX_ROLES_HOME: path.join(home, "roles") }, encoding: "utf8",
});
assert.equal(install.status, 0, install.stderr);
const config = JSON.parse(readFileSync(path.join(home, "paseo", "config.json"), "utf8"));
assert.deepEqual(Object.keys(config.agents.providers).sort(), ["codex-lead", "codex-peer", "codex-supervisor"]);
const expectedLauncher = process.platform === "win32"
  ? [process.execPath, path.join(home, "paseo", "bin", "codex-role-app-server.mjs")]
  : [path.join(home, "paseo", "bin", "codex-role-app-server")];
assert.deepEqual(config.agents.providers["codex-lead"].command, expectedLauncher);
assert.ok(existsSync(expectedLauncher.at(-1)));
const hookManifest = JSON.parse(readFileSync(path.join(home, "roles", "peer", "hooks.json"), "utf8"));
const hookCommand = hookManifest.hooks.PreToolUse[0].hooks[0].command;
assert.doesNotMatch(hookCommand, /\$CODEX_HOME/);
assert.match(hookCommand, /hooks[\\/]pre-tool-use\.mjs/);
assert.equal(readFileSync(path.join(home, "roles", "peer", "auth.json"), "utf8"), "fixture credential\n");
assert.ok(existsSync(path.join(home, "roles", "peer", "config.toml")));
assert.ok(!existsSync(path.join(home, "roles", "worker", "config.toml")));
console.log("[paseo-team] codex SLP policy tests passed");
