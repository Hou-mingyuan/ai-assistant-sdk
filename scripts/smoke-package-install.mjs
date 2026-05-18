#!/usr/bin/env node
/**
 * Build the UI package tarball, install it into a temporary consumer project,
 * and verify every public export resolves from that consumer context.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const isCli = process.argv[1] && path.resolve(process.argv[1]) === modulePath;
const root = path.resolve(path.dirname(modulePath), "..");
const packageDir = path.join(root, "ai-assistant-ui");

const EXPORTS = [
    "@ai-assistant/vue",
    "@ai-assistant/vue/admin",
    "@ai-assistant/vue/form-fill",
    "@ai-assistant/vue/mcp",
    "@ai-assistant/vue/screenshot",
    "@ai-assistant/vue/plugin",
    "@ai-assistant/vue/wc",
    "@ai-assistant/vue/dist/style.css",
];

export function buildConsumerProbe(packageName) {
    const imports = [
        packageName,
        `${packageName}/admin`,
        `${packageName}/form-fill`,
        `${packageName}/mcp`,
        `${packageName}/screenshot`,
        `${packageName}/plugin`,
        `${packageName}/wc`,
        `${packageName}/dist/style.css`,
    ];
    return [
        "import { createRequire } from 'node:module';",
        "const require = createRequire(import.meta.url);",
        "",
        ...imports.map(
            (specifier) => `console.log(import.meta.resolve('${specifier}'));`,
        ),
        ...imports.map(
            (specifier) => `console.log(require.resolve('${specifier}'));`,
        ),
        "",
    ].join("\n");
}

function run(command, args, cwd) {
    const result = spawnSync(command, args, {
        cwd,
        stdio: "inherit",
        shell: process.platform === "win32",
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(" ")} failed with exit code ${result.status}`,
        );
    }
}

function npmCommand() {
    return "npm";
}

if (isCli) {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
    );
    const tarballName = `${packageJson.name.replace("@", "").replace("/", "-")}-${packageJson.version}.tgz`;
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "ai-assistant-package-smoke-"),
    );
    const tarballPath = path.join(tempDir, tarballName);

    try {
        run(npmCommand(), ["pack", "--pack-destination", tempDir], packageDir);
        run(npmCommand(), ["init", "-y"], tempDir);
        run(
            npmCommand(),
            ["install", "--no-audit", "--no-fund", tarballPath],
            tempDir,
        );

        const probePath = path.join(tempDir, "probe.mjs");
        fs.writeFileSync(
            probePath,
            buildConsumerProbe(packageJson.name),
            "utf8",
        );
        run(process.execPath, [probePath], tempDir);

        console.log(
            `Package install smoke OK (${EXPORTS.length} exports resolved).`,
        );
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
