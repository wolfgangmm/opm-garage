// ── Python runtime: Pyodide from the CDN, opm from the wheel beside the page ─
import type { PyodideAPI } from 'pyodide';
import { PYODIDE, WHEEL } from '../config.ts';
import glue from './glue.py';

/** The loaded runtime. Set once by loadRuntime; everything else imports it. */
export let py: PyodideAPI;

export async function loadRuntime(progress: (step: string, pct: number) => void): Promise<PyodideAPI> {
  progress('Loading Python…', 10);
  const { loadPyodide } = await import(PYODIDE + 'pyodide.mjs') as typeof import('pyodide');
  const runtime = await loadPyodide({ indexURL: PYODIDE });
  progress('Loading packages…', 40);
  await runtime.loadPackage(['micropip', 'lxml', 'jinja2', 'pygments', 'platformdirs']);
  runtime.FS.writeFile('/tmp/' + WHEEL, new Uint8Array(await (await fetch('dist/' + WHEEL)).arrayBuffer()));
  progress('Installing opm…', 65);
  await runtime.runPythonAsync(`
import micropip
await micropip.install(['elementpath>=4.8', 'python-docx>=1.1', 'babel'])
await micropip.install('emfs:/tmp/${WHEEL}', deps=False)
`);
  await runtime.runPythonAsync(glue);
  py = runtime;
  return runtime;
}
