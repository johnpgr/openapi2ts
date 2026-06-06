import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "src/cli/index.ts");
const petstoreFixture = path.join(root, "test/fixtures/petstore.json");

function runCli(args: string[], cwd = root): { stdout: string; stderr: string; status: number } {
    try {
        const stdout = execFileSync(process.execPath, [cli, ...args], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return { stdout, stderr: "", status: 0 };
    } catch (error) {
        const e = error as { status?: number; stdout?: string; stderr?: string };
        return {
            stdout: e.stdout ?? "",
            stderr: e.stderr ?? "",
            status: e.status ?? 1,
        };
    }
}

test("CLI quick generate --file --out writes api-client.ts", () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "openapi2ts-quick-"));
    try {
        const result = runCli(["generate", "--file", petstoreFixture, "--out", outDir]);
        assert.equal(result.status, 0, result.stderr);

        const clientPath = path.join(outDir, "api-client.ts");
        assert.ok(existsSync(clientPath), "expected api-client.ts");
        const content = readFileSync(clientPath, "utf8");
        assert.match(content, /export class ApiClient/);
    } finally {
        rmSync(outDir, { recursive: true, force: true });
    }
});

test("CLI quick check --file --out succeeds when output is up to date", () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "openapi2ts-quick-check-"));
    try {
        const generate = runCli(["generate", "--file", petstoreFixture, "--out", outDir]);
        assert.equal(generate.status, 0, generate.stderr);

        const check = runCli(["check", "--file", petstoreFixture, "--out", outDir]);
        assert.equal(check.status, 0, check.stderr);
    } finally {
        rmSync(outDir, { recursive: true, force: true });
    }
});

test("CLI quick generate supports --name and --base-url", () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "openapi2ts-quick-named-"));
    try {
        const result = runCli([
            "generate",
            "--file",
            petstoreFixture,
            "--out",
            outDir,
            "--name",
            "PetStoreClient",
            "--base-url",
            "https://petstore.example.com",
        ]);
        assert.equal(result.status, 0, result.stderr);

        const clientPath = path.join(outDir, "pet-store-client.ts");
        assert.ok(existsSync(clientPath));
        const content = readFileSync(clientPath, "utf8");
        assert.match(content, /export class PetStoreClient/);
        assert.match(content, /baseUrl: "https:\/\/petstore\.example\.com"/);
    } finally {
        rmSync(outDir, { recursive: true, force: true });
    }
});

test("CLI rejects invalid quick flag combinations", () => {
    const result = runCli(["generate", "--file", petstoreFixture]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires --out/);
});
