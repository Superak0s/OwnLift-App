#!/usr/bin/env python3
"""Find and delete unused StyleSheet.create() keys under src/, in batches of 5,
verifying each batch with `npx tsc --noEmit` and reverting on failure.

Usage:
    python scripts/find_unused_styles.py            # dry run, just report
    python scripts/find_unused_styles.py --apply     # actually delete + verify

Limitations (by design, see conversation):
- Usage detection is repo-wide but keyed on the style NAME only (.key / ['key']),
  not the object it's a property of — needed because style objects here are
  routinely passed as typed props and consumed under a different local variable
  name in other files. Trade-off: two unrelated style objects that happen to
  share a key name (e.g. two different "container") will each be treated as
  "used" if the name appears anywhere, so some genuinely dead keys may be kept.
- If a file uses styles[someVariable] (dynamic bracket access) anywhere, ALL
  candidates in that file are skipped — we can't know which key it resolves to.
- Keys matching DENYLIST substrings (container, wrapper, screen, root, safearea,
  content) are never deleted, even if seemingly unused.
- tsc won't catch a key only referenced via a dynamic string built elsewhere
  (e.g. a name assembled at runtime) — this is a text/AST scan, not a full
  data-flow analysis.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
BATCH_SIZE = 5
DENYLIST = [
    "container",
    "wrapper",
    "screen",
    "root",
    "safearea",
    "content",
    "header",
    "footer",
    "section",
    "card",
    "overlay",
    "modal",
    "background",
    "body",
    "layout",
    "list",
    "scroll",
]

KEY_RE = re.compile(r"""^\s*(?:['"]?([A-Za-z_$][\w$]*)['"]?)\s*:""")


def match_brace(text, open_idx):
    depth = 0
    i = open_idx
    n = len(text)
    in_str = None
    while i < n:
        c = text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_str = c
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            i = j if j != -1 else n
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = j + 2 if j != -1 else n
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def find_style_blocks(text):
    blocks = []
    # direct: const styles = StyleSheet.create({ ... })
    for m in re.finditer(r"(?:const|let|var)\s+(\w+)\s*=\s*StyleSheet\.create\s*\(\s*\{", text):
        varname = m.group(1)
        obj_start = m.end() - 1
        obj_end = match_brace(text, obj_start)
        if obj_end is not None:
            blocks.append((varname, obj_start, obj_end))

    # factory: const makeStyles = (colors) => StyleSheet.create({ ... }), consumed
    # elsewhere as `const styles = makeStyles(...)` or `const styles = useMemo(() => makeStyles(...), ...)`
    for m in re.finditer(
        r"(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*(?::[^=]+)?=>\s*StyleSheet\.create\s*\(\s*\{",
        text,
    ):
        factory_name = m.group(1)
        obj_start = m.end() - 1
        obj_end = match_brace(text, obj_start)
        if obj_end is None:
            continue
        consumer = re.search(
            rf"(?:const|let)\s+(\w+)\s*=\s*(?:useMemo\(\s*\(\)\s*=>\s*)?{re.escape(factory_name)}\(",
            text,
        )
        if consumer:
            blocks.append((consumer.group(1), obj_start, obj_end))
        # else: can't tell which variable holds the result, skip this block entirely.
    return blocks


def top_level_entries(text, obj_start, obj_end):
    entries = []
    i = obj_start + 1
    depth = 1
    in_str = None
    entry_start = None
    key = None
    n = len(text)
    while i < obj_end:
        c = text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_str = c
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            i = j if j != -1 else obj_end
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = j + 2 if j != -1 else obj_end
            continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
        elif c == "," and depth == 1:
            if entry_start is not None:
                entries.append((key, entry_start, i + 1))
            entry_start = None
            key = None
            i += 1
            continue
        if depth == 1 and entry_start is None and not c.isspace():
            entry_start = i
            km = KEY_RE.match(text[i:])
            if km:
                key = km.group(1)
        i += 1
    if entry_start is not None:
        entries.append((key, entry_start, obj_end))
    return entries


def is_denied(key):
    lk = key.lower()
    return any(d in lk for d in DENYLIST)


def load_all_files():
    return {p: p.read_text(encoding="utf-8") for p in list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx"))}


def collect_entries(path, text):
    entries = []
    for varname, obj_start, obj_end in find_style_blocks(text):
        # dynamic bracket access with a non-string key anywhere in the file
        # means we can't trust "unused" for this varname's styles at all.
        if re.search(rf"\b{re.escape(varname)}\[(?!['\"])", text):
            continue
        for key, start, end in top_level_entries(text, obj_start, obj_end):
            if not key or is_denied(key):
                continue
            entries.append({"file": path, "key": key, "start": start, "end": end})
    return entries


def collect_all_candidates():
    """Style objects here are routinely passed as typed props into other files
    and consumed under a different local variable name (e.g. FriendsScreen's
    makeWatchStyles is used as `watchStyles` in FriendActionsTab.tsx), so
    usage is checked repo-wide by key name alone (`.key` / ['key']), not
    scoped to a single file or variable name.
    """
    file_texts = load_all_files()
    all_entries = [e for path, text in file_texts.items() for e in collect_entries(path, text)]

    candidates = []
    for c in all_entries:
        usage = re.compile(rf"\.{re.escape(c['key'])}\b|\[['\"]{re.escape(c['key'])}['\"]\]")
        used = False
        for path, text in file_texts.items():
            haystack = text[: c["start"]] + text[c["end"] :] if path == c["file"] else text
            if usage.search(haystack):
                used = True
                break
        if not used:
            candidates.append(c)
    return candidates


def delete_candidates(group):
    by_file = {}
    for c in group:
        by_file.setdefault(c["file"], []).append(c)
    backups = {}
    for path, entries in by_file.items():
        text = path.read_text(encoding="utf-8")
        backups[path] = text
        for c in sorted(entries, key=lambda c: c["start"], reverse=True):
            text = text[: c["start"]] + text[c["end"] :]
        path.write_text(text, encoding="utf-8")
    return backups


def restore(backups):
    for path, text in backups.items():
        path.write_text(text, encoding="utf-8")


def run_tsc():
    print("    running `npx tsc --noEmit` ...", flush=True)
    result = subprocess.run(
        ["npx", "tsc", "--noEmit"], cwd=ROOT, capture_output=True, text=True, shell=True
    )
    ok = result.returncode == 0
    if ok:
        print("    tsc passed", flush=True)
    else:
        print("    tsc FAILED:", flush=True)
        output = (result.stdout + result.stderr).strip()
        print("\n".join(f"      {line}" for line in output.splitlines()), flush=True)
    return ok


def try_group(group, kept, removed):
    if not group:
        return
    backups = delete_candidates(group)
    if run_tsc():
        for c in group:
            removed.append(c)
            print(f"  deleted {c['file'].relative_to(ROOT)}::{c['key']}")
        return
    restore(backups)
    if len(group) == 1:
        kept.append(group[0])
        print(f"  KEEP (breaks tsc) {group[0]['file'].relative_to(ROOT)}::{group[0]['key']}")
        return
    for c in group:
        try_group([c], kept, removed)


def main():
    apply = "--apply" in sys.argv
    candidates = collect_all_candidates()
    if not candidates:
        print("No unused style candidates found.")
        return
    print(f"Found {len(candidates)} candidate(s) for deletion.")
    for c in candidates:
        print(f"  {c['file'].relative_to(ROOT)}::{c['key']}")
    if not apply:
        print("\nDry run only. Re-run with --apply to delete + verify with tsc.")
        return

    kept, removed = [], []
    for i in range(0, len(candidates), BATCH_SIZE):
        batch = candidates[i : i + BATCH_SIZE]
        print(f"\nBatch {i // BATCH_SIZE + 1}: {[c['key'] for c in batch]}")
        try_group(batch, kept, removed)

    print(f"\nDone. Removed {len(removed)}, kept {len(kept)} due to tsc failures.")


if __name__ == "__main__":
    main()
