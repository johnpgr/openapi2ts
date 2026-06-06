# openapi2ts

Zero-runtime-dependency OpenAPI → TypeScript client generator for **Node 24+**.

Inspired by [mdevils/api-typescript-generator](https://github.com/mdevils/api-typescript-generator). This package ships **raw TypeScript** in `src/` — no build step, no compiled `lib/`.

- **Published `dependencies`:** none
- **Peer dependency:** `typescript >= 6.0.0` (codegen via `ts.factory` / `ts.createPrinter`)
- **OpenAPI input:** JSON only (OpenAPI 3.0 / 3.1)
- **Runtime:** Node 24+ with native [type stripping](https://nodejs.org/api/typescript.html)

Generated clients use grouped service classes:

```ts
const client = new ApiClient({ baseUrl: "/api" })
await client.pet.findPetsByStatus({ status: ["available"] })
```

---

## Quick start

```bash
npm install
node src/cli/index.ts generate test/snapshot-config.ts
node src/cli/index.ts check test/snapshot-config.ts
```

npm scripts:

```bash
npm run test:update   # regenerate snapshots
npm run typecheck     # tsc --noEmit
npm test
```

When installed, npm links the `openapi2ts` binary to `src/cli/index.ts`.

Relative imports in `src/` use explicit `.ts` extensions (Node native ESM). After adding modules, run `npm run patch-imports`.

---

## Using in another project (git submodule)

This package is **not published to npm (and never will be)**. Pull it into a consumer repo as a **git submodule** and wire it with a `file:` dependency.

### 1. Add the submodule

From your app repo root:

```bash
git submodule add https://github.com/johnpgr/openapi2ts.git vendor/openapi2ts
```

Pick any path you like (`vendor/openapi2ts` is just an example). Commit `.gitmodules` and the submodule pointer.

Cloners need submodules initialized:

```bash
git clone --recurse-submodules <your-app-repo>
# or, in an existing clone:
git submodule update --init --recursive
```

### 2. Point `package.json` at the checkout

```json
{
  "dependencies": {
    "openapi2ts": "file:vendor/openapi2ts"
  },
  "devDependencies": {
    "typescript": "^6.0.0"
  },
  "scripts": {
    "api:generate": "openapi2ts generate",
    "api:check": "openapi2ts check"
  }
}
```

Then install from your app root:

```bash
npm install
```

`openapi2ts` is a **peer dependency** — your app must install `typescript` (>= 6). The consumer also needs **Node 24+** (native type stripping for the shipped `.ts` sources and CLI).

npm links the `openapi2ts` binary to `vendor/openapi2ts/src/cli/index.ts`, so `npx openapi2ts` and the scripts above work like a normal local package.

### 3. Add a config and generate

Put a config in your app root (auto-discovered) or pass it explicitly:

```ts
// openapi2ts.config.ts
import type { Openapi2tsConfig } from "openapi2ts"

export default {
  generates: [{
    type: "openapiClient",
    document: {
      source: { type: "file", path: "./openapi/schema.json" }
    },
    outputDirPath: "./src/api",
    client: { name: "ApiClient", baseUrl: "/api" }
  }]
} satisfies Openapi2tsConfig
```

```bash
npm run api:generate
npm run api:check    # fails if generated output is stale
```

Quick mode without a config file also works:

```bash
npx openapi2ts generate --file ./openapi/schema.json --out ./src/api
```

### 4. Programmatic use (optional)

```ts
import { openapiToTypescriptClient } from "openapi2ts/openapi-client"
import type { OpenApiDocument } from "openapi2ts/openapi"
```

Types and runtime entry points resolve to the submodule’s raw `src/*.ts` files via `package.json` `exports`.

### 5. Updating the generator

When you want a newer `openapi2ts` revision:

```bash
cd vendor/openapi2ts
git fetch && git checkout <ref>    # branch, tag, or commit
cd ../..
git add vendor/openapi2ts
npm install                        # refresh the file: link if needed
npm run api:generate
```

Pin the submodule to a commit (or tag) you trust; treat bumps like any other vendored dependency.

---

## Goals

- Zero published dependencies — runtime uses Node built-ins plus the peer `typescript` install
- TypeScript peer only
- Node 24+ with native type stripping (prefer **>= 24.12.0**)
- JSON OpenAPI 3.0 / 3.1 via `JSON.parse` only
- Tag-grouped service classes and `client.tag.operation()` accessors
- Ship raw `.ts` source (monorepo / direct checkout usage; no compile step in this repo)

## Non-goals

- YAML parsing
- Bundled Zod / runtime validation
- AsyncAPI / legacy generators

---

## Package contract

| Field | Value |
|-------|-------|
| `dependencies` | `{}` |
| `peerDependencies.typescript` | `>=6.0.0` |
| `engines.node` | `>=24.0.0` (prefer `>=24.12.0`) |
| `main` | `./src/index.ts` |
| `bin` | `openapi2ts` → `./src/cli/index.ts` |

Dev-only tooling (`typescript` for `tsc --noEmit` ) does not ship to consumers.

### Programmatic exports

- `openapi2ts` — config types and shared utilities
- `openapi2ts/openapi` — OpenAPI document types
- `openapi2ts/openapi-client` — client generator types

```ts
export async function openapiToTypescriptClient(params: {
  document: OpenApiDocument
  generateConfig: OpenApiClientGeneratorConfig
}): Promise<ClientGenerationResult>
```

**Not supported in config:** `validation`, `validateResponse`, validation provider types.

---

## CLI

```
openapi2ts generate [config]
openapi2ts check [config]
openapi2ts generate --url <url> --out <dir>
openapi2ts generate --file <path> --out <dir>
openapi2ts check --url <url> --out <dir>
openapi2ts check --file <path> --out <dir>

Options:
  --url <url>        OpenAPI JSON document URL (quick mode)
  --file <path>      OpenAPI JSON document file (quick mode)
  --out, -o <dir>    Output directory (required in quick mode)
  --name <name>      Client class name (quick mode, default: ApiClient)
  --base-url <url>   Generated client base URL (quick mode)
  -h, --help         Show help
```

When `[config]` is omitted, the CLI looks in the **current working directory** for:

`openapi2ts.config.ts` → `.mts` → `.cts` → `.mjs` → `.cjs` → `.js`

### Config file (full options)

```bash
openapi2ts generate openapi2ts.config.ts
openapi2ts check openapi2ts.config.ts
openapi2ts generate    # auto-discovers openapi2ts.config.*
```

### Quick one-off (narrow defaults)

```bash
openapi2ts generate --file ./openapi/schema.json --out ./src/api
openapi2ts generate --url http://127.0.0.1:8000/api/schema/?format=json -o ./src/api
openapi2ts generate --file ./openapi/schema.json --out ./src/api --name MyApiClient --base-url /api
```

Quick mode uses `ApiClient` as the default class name and does not expose cleanup, layout, JSDoc hooks, or document patches — use a config file for those.

| Exit code | Condition |
|-----------|-----------|
| `0` | Success, or `--help` |
| `1` | Stale `check`, load/generation error, invalid usage |

---

## Configuration

### Supported config extensions

| Extension | Loading |
|-----------|---------|
| `.js`, `.mjs`, `.cjs` | Native ESM/CJS |
| `.ts`, `.mts`, `.cts` | Node 24 native type stripping |

Configs must use **erasable TypeScript only** when using `.ts`:

- Allowed: `import type`, interfaces, type aliases, `satisfies`, annotations
- Not allowed: `enum`, runtime `namespace`, parameter properties, decorators, path aliases

Relative imports in config files need explicit extensions (e.g. `./helpers.js`).

Async configs supported: `export default async function (): Promise<Openapi2tsConfig>`.

### Example

```js
// openapi2ts.config.mjs
export default {
  generates: [{
    type: "openapiClient",
    document: {
      source: { type: "file", path: "./openapi/schema.json" }
    },
    outputDirPath: "./src/api",
    client: {
      name: "ApiClient",
      baseUrl: "/api"
    },
    operations: { showDeprecatedWarnings: true },
    models: { cleanupFiles: true },
    services: { cleanupFiles: true },
    core: { cleanupFiles: true }
  }]
};
```

TypeScript config variant:

```ts
import type { Openapi2tsConfig } from "openapi2ts"

export default {
  generates: [/* … */]
} satisfies Openapi2tsConfig
```

---

## OpenAPI input

```ts
type CommonApiToTypescriptGeneratorSource =
  | { type: "file"; path: string }
  | { type: "url"; url: string }
  | { type: "object"; object: unknown }
  | { type: "string"; data: string }
```

| Source | Parser |
|--------|--------|
| `file` | Read UTF-8 → `JSON.parse` |
| `url` | `fetch` → `JSON.parse` |
| `string` | `JSON.parse` |
| `object` | Use as-is |

YAML input fails with a clear JSON-only error. Post-parse: optional `document.patch` → `processOpenApiDocument` → `resolveDocumentReferences`.

### drf-spectacular

Always emit JSON:

```bash
python manage.py spectacular \
  --skip-checks \
  --format openapi-json \
  --file ../../packages/contracts/openapi/gestao-salas.openapi.json
```

Without `--format openapi-json`, drf-spectacular may write YAML into a `.json` file and `JSON.parse` will fail.

---

## Code generation architecture

- **`src/emit/`** — TypeScript compiler API (`ts.factory`, `ts.createPrinter`)
- **`src/utils/collections.ts`** — small collection helpers (no Ramda)
- **`src/schema-to-typescript/common/core/`** — static HTTP client templates; import paths rewritten at generation time
- **No** Babel, Ramda, js-yaml, yargs, or ts-node in `src/`

---

## Golden snapshots

Reference output lives in `test/snapshots/petstore/` (9 files: client, services, models, core).

```bash
node src/cli/index.ts check test/snapshot-config.ts
npm run test:update   # regenerate from current generator
```

See [`test/snapshots/README.md`](test/snapshots/README.md).

---

## Repository layout

```
openapi2ts/
  src/
    cli/                 # generate / check commands
    emit/                # ts.factory codegen layer
    schemas/             # OpenAPI loading & patching
    schema-to-typescript/
      common/
        core/            # HTTP client templates
    utils/
  test/
    fixtures/petstore.json
    snapshots/petstore/  # golden output
```

---

## Testing

| Area | How |
|------|-----|
| Package contract | `npm test` — zero deps, raw TS entry, no forbidden imports in `src/` |
| Snapshot parity | `node src/cli/index.ts check test/snapshot-config.ts` |
| Types | `npm run typecheck` |
| JSON-only input | YAML / YAML-in-`.json` must fail with clear error |
| CLI | `generate`, `check`, `--help`, invalid command exit codes |

---

## References

- [Node.js TypeScript](https://nodejs.org/api/typescript.html)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [drf-spectacular](https://drf-spectacular.readthedocs.io/)
