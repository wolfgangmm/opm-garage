# Python side of the page: thin helpers over opm, called from runtime/opm.ts.
import json
import shutil
import sys
from pathlib import Path

from opm import Project
from opm.scaffold import EXAMPLES, VOCABULARIES, InitOptions, scaffold


def list_examples():
    return json.dumps([{'name': e.name, 'title': e.title, 'summary': e.summary} for e in EXAMPLES])


def list_vocabs():
    labels = {'tei': 'TEI', 'jats': 'JATS', 'docbook': 'DocBook'}
    return json.dumps([[v, labels.get(v, v)] for v in VOCABULARIES])


def reset_dir(d):
    shutil.rmtree(d, ignore_errors=True)
    Path(d).mkdir(parents=True)


def remove_path(p):
    p = Path(p)
    shutil.rmtree(p) if p.is_dir() else p.unlink()


# Projects made here never get README.md, AGENTS.md, CLAUDE.md or .gitignore:
# they live in the browser, not in a repository.
def init_project(d, vocab, templates):
    reset_dir(d)
    return scaffold(InitOptions(directory=Path(d), vocabulary=vocab, templates=bool(templates), bare=True)).sample_path


def copy_example(d, name, templates):
    reset_dir(d)
    return scaffold(InitOptions(directory=Path(d), example=name, templates=bool(templates), bare=True)).sample_path


def convert(root, xml, mode):
    root = Path(root)
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    return Project.load(root / 'opm.toml').transform(root / xml, mode=mode)


def chunk(root, xml, out):
    """Chunk root/xml into HTML pages below out; returns the files written and the page to open first."""
    root = Path(root)
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    project = Project.load(root / 'opm.toml')
    if not project.config.chunking:
        raise ValueError('This project has no [chunking] section in opm.toml, so there is nothing to chunk.')
    out = Path(out)
    project.chunk(root / xml, format='html', output_dir=out, overwrite=True)
    files = sorted(str(p.relative_to(out)) for p in out.rglob('*') if p.is_file())
    # as `opm chunk --preview` does: the site index, else the first numbered page
    landing = 'index.html' if 'index.html' in files else next(
        (f for f in files if f.endswith('.html')), '')
    return json.dumps({'files': files, 'landing': landing})


def packaged_odd_text(name):
    """Text of an ODD shipped with opm (e.g. teipublisher.odd), or None."""
    from opm.resources import packaged_odd
    try:
        return packaged_odd(name).read_text(encoding='utf-8')
    except FileNotFoundError:
        return None
