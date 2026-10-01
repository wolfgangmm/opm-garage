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
