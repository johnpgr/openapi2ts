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

Dev-only tooling (`typescript` for `tsc --noEmit`, `scripts/*.mjs`) does not ship to consumers.

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
  scripts/               # repo maintenance (snapshots, import patching)
  test/
    fixtures/petstore.json
    snapshots/petstore/  # golden output
```

### `scripts/` (maintenance only)

| Script | Purpose |
|--------|---------|
| `generate-snapshots.mjs` | Refresh goldens via local mdevils/api-typescript-generator checkout |
| `patch-import-extensions.mjs` | Add `.ts` to relative imports (`npm run patch-imports`) |
| `fix-type-imports.mjs` | Split value / `import type` imports (migration helper) |

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
