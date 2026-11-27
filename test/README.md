# Tests

```bash
npm test                # static checks + browser tests
npm run test:static     # ~2s, no build, no browser
npm run test:e2e        # browser tests (builds editor and runtime in memory)
npm run test:baseline   # re-render the reference screenshots
npm run test:report     # open the last HTML report
```

Use Node 22 (`nvm use`). The browser tests need Playwright's Chromium (`npx playwright install chromium`).

Reference screenshots are not committed, run `npm run test:baseline` once before the first `npm test` (and again after pulling a new `master`).

A GitHub Actions workflow for these tests is kept disabled in `ci/github-test.yml`, copy it to `.github/workflows/` to enable it.

## Static checks (`static/check.mjs`)

Parses `source/core` and `source/editor` and fails on:

- syntax errors
- derived class constructors using `this` before `super()`, or never calling it (mark intentional ones with `static-check: allow-no-super`)
- ES5 `Parent.call(this)` or `X.prototype = ...` on ES6 classes, `super.method(arguments)`
- imports of names that three.js or the imported module does not export, missing modules
- undefined identifiers not in `static/undefined-baseline.json` (known existing ones, `--update-baseline` to rewrite it)

Webpack is also set to fail the build when a module imports a name that is not exported.

## Browser tests (`e2e/`)

Run in Chromium with software WebGL against a dev server (`webpack.test.js`) that builds in memory, `docs/editor` is never written.
Every test fails on page errors, `console.error` or alert dialogs (`fixtures.mjs`).

- `editor.spec.mjs`: the editor as a list of steps (`[name, async (page) => {...}]`), errors are checked after each step. Add a row to cover a feature.
- `examples.spec.mjs`: every project in `docs/examples` is found automatically, loaded with the runtime (`harness/runtime.html`), run for two seconds of frames with a frozen clock and seeded `Math.random`, round-tripped through `toJSON`/`ObjectLoader`, and its frame compared with `e2e/screenshots/<name>.png` (local, not in git).

Reference screenshots are rendered with the runtime published on `master` (`docs/editor/files/runtime/nunu.min.js`, taken from git by `e2e/setup.mjs`, set `NUNU_BASELINE_REF` for another branch), so a diff means the frame looks different from the previous release.

Exceptions are data in the `quirks` table of `examples.spec.mjs`:

| Quirk | Effect |
| --- | --- |
| `skip: reason` | not run |
| `fails: reason` | known issue, expected to fail, Playwright reports it when it starts passing (remove the entry then) |
| `self: reason` | compared with a render of this branch (`<name>-self.png`) instead of the old runtime, e.g. frames that depend on the engine random stream |
| `fixedStep: true` | steps the physics-heavy examples every 16 ms and clears the framebuffer before capturing, so stale depth and an extra simulation step cannot change the reference image |
| `maxDiffPixelRatio: number` | sets an example-specific screenshot tolerance. The `nunu` example allows up to 4% for residual differences in physics and rain between runtimes. |
