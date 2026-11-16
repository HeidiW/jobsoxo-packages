# jobsoxo-packages

Open-source building blocks from JobsOxo, the back office for painting contractors.

Each package in `packages/` is published to npm under the `@jobsoxo` scope and
is usable on its own. They are pure TypeScript libraries: no database, no
framework, no HTTP.

## Packages

| Package | What it does |
| --- | --- |
| [`@jobsoxo/staged-billing`](packages/staged-billing) | Deposit, progress and final invoice math for contractors. |

## Working in this repo

This is an npm workspaces monorepo. Every package builds to ESM and CommonJS
with `.d.ts` types using [tsup](https://tsup.egoist.dev), and tests run with
[Vitest](https://vitest.dev).

```sh
npm install        # install everything, link workspaces
npm test           # run every package's tests
npm run build      # build every package to its dist/
npm run typecheck  # tsc --noEmit in every package
```

To work on a single package:

```sh
npm test -w @jobsoxo/staged-billing
npm run build -w @jobsoxo/staged-billing
```

## License

MIT. See [LICENSE](LICENSE).
