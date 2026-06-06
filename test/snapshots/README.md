# Golden snapshots

Reference output for the petstore fixture lives in `petstore/` (9 files: client, services, models, core).

Uses `test/fixtures/petstore.json` and `test/snapshot-config.ts`.

## Validate

```bash
node src/cli/index.ts check test/snapshot-config.ts
```

When intentionally updating expected output:

```bash
npm run test:update
```

Review diffs before committing — output should remain type-checkable and preserve `client.tag.operation()` ergonomics.
