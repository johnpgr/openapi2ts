import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("package.json has the expected published dependencies", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.deepEqual(pkg.dependencies ?? {}, { "ts-blank-space": "^0.9.0" });
    assert.equal(Object.keys(pkg.peerDependencies ?? {}).length, 1);
    assert.ok(pkg.peerDependencies.typescript);
});

test("package.json ships raw TypeScript with a loader-backed bin wrapper", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pkg.main, "./src/index.ts");
    assert.equal(pkg.types, "./src/index.ts");
    assert.equal(pkg.bin["openapi2ts"], "./cli.js");
    assert.equal(pkg.scripts.build, undefined);
    assert.equal(pkg.scripts.postinstall, undefined);
    assert.equal(pkg.exports["."].types, "./src/index.ts");
    assert.equal(pkg.exports["."].default, "./src/index.ts");
    assert.equal(pkg.exports["./openapi"].types, "./src/openapi.ts");
    assert.equal(pkg.exports["./openapi"].default, "./src/openapi.ts");
    assert.equal(pkg.exports["./openapi-client"].types, "./src/openapi-client.ts");
    assert.equal(pkg.exports["./openapi-client"].default, "./src/openapi-client.ts");
});

test("src/ contains no babel, ramda, yaml, yargs, or ts-node imports", () => {
    const forbidden = /babel|ramda|js-yaml|yargs|ts-node/;
    const files = collectSourceFiles(join(root, "src"));
    const hits = files.filter((file) => forbidden.test(readFileSync(file, "utf8"))).join("\n");
    assert.equal(hits, "", `Forbidden imports found in: ${hits}`);
});

function collectSourceFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            files.push(fullPath);
        }
    }
    return files;
}
