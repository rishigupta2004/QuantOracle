import subprocess

import pytest

pytestmark = pytest.mark.unit


def test_secret_files_not_tracked_by_git():
    # We don't inspect values (avoid accidental secret printing); just ensure files aren't tracked.
    out = subprocess.check_output(["git", "ls-files"], text=True)
    tracked = set(out.splitlines())
    assert ".env" not in tracked
    assert ".streamlit/secrets.toml" not in tracked


def test_gitignore_blocks_secret_files():
    gi = open(".gitignore", "r", encoding="utf-8").read()
    assert ".env" in gi
    assert ".streamlit/" in gi

