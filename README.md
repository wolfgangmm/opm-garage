# OPM Garage

Transform XML with the Open Processing Model, entirely in the browser. Runs the `opm` wheel under Pyodide (CPython in WebAssembly); there is no server-side code.

    uv build --wheel ../tei-publisher-py -o dist     # the opm wheel the page installs
    npm install
    npm run dev       # bundles src/ into dist/app.js on every change and serves http://localhost:8000
    npm run build     # minified bundle for deployment
    npm run check     # type check (TypeScript, no output)
    npm test          # unit tests, then every output mode headless under Pyodide in Node

The page works on projects laid out like `opm init` creates them (`opm.toml`, `odd/`, `data/`, `templates/`). They live in the browser (IndexedDB), are saved as you type, and export as a `.zip` the `opm` CLI can run.

## Code layout

    src/main.ts           boot: wire the panes, load Python and opm, reopen the last project
    src/state.ts          the shared state and a small event bus
    src/actions.ts        changes to state that several panes care about (open a file, a project, …)
    src/config.ts         output modes, CDN URLs, the wheel name
    src/runtime/          Pyodide loading; glue.py and its typed wrappers in opm.ts
    src/project/          project files in Pyodide's file system, opm.toml, zip, IndexedDB, autosave
    src/ui/               one module per pane or widget: editor, explorer, output, start, switcher, …
    tests/unit/           node:test tests for the pure modules
    tests/node/           headless Pyodide runs of the wheel

Panes never call each other. An action changes `state` and emits what changed (`project`, `files`, `config`, `edit`, `file`, `source`); each pane subscribes to the events that affect it in its `init…()` function.

## License

Copyright (C) 2026 e-editiones

OPM Garage is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

The opm logo is a trademark of its owners and is not covered by this licence.
