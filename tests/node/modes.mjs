import { loadPyodide } from 'pyodide';
import fs from 'node:fs';
const py = await loadPyodide();
await py.loadPackage(['micropip','lxml','jinja2','pygments','platformdirs']);
const w='open_processing_model-0.9.0-py3-none-any.whl';
py.FS.writeFile('/tmp/'+w, fs.readFileSync('dist/'+w));
await py.runPythonAsync(`
import micropip
await micropip.install(['elementpath>=4.8','python-docx>=1.1','babel'])
await micropip.install('emfs:/tmp/${w}', deps=False)
from opm import Project
from lxml import etree
p=Project()
t=etree.fromstring(open('/dev/null').read().encode() or b'<x/>').getroottree()
`);
py.FS.writeFile('/tmp/doc.xml', fs.readFileSync('sample.xml'));
for (const m of ['web','markdown','json','docx','typst','epub']) {
  try { console.log(m, await py.runPythonAsync(`r=p.transform(etree.parse('/tmp/doc.xml'), mode='${m}'); f"{type(r).__name__} {len(r)}"`)); }
  catch (e) { console.log(m, 'FAIL', String(e).split('\n').slice(-2).join(' ')); }
}
