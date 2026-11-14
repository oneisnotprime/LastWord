#!/usr/bin/env python3
"""Checks a generated theme file: python3 tools/themes/check.py tools/themes/out_<theme>.txt
Prints every problem and a count of good entries. Same rules build_demo.py applies."""
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from generate_words import by_role, EXCLUDED
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
props = {p["id"]: p for p in json.load(open(os.path.join(R, "data/properties.json")))["properties"]}
lex = {l.split("\t")[0] for l in list(open(os.path.join(R, "data/lexicon.tsv")))[1:]}
hand = {m.group(1) for m in re.finditer(r"^([a-z]+):", open(os.path.join(R, "tools/demo_words.txt")).read(), re.M)}
allowed = by_role()
role = arch = None; good = 0; seen = set(); bad = 0
for n, line in enumerate(open(sys.argv[1]), 1):
    line = line.strip()
    m = re.fullmatch(r"# (noun|verb|adjective|adverb) (\w+)", line)
    if m:
        role, arch = m.groups()
        if arch not in allowed[role]: print(f"{n}: archetype {arch} not allowed for {role}"); bad += 1
        continue
    if not line or line.startswith("#"): continue
    w, _, rest = line.partition(":"); w = w.strip()
    probs = []
    if not role: probs.append("no section header before it")
    if w in seen: probs.append("duplicate")
    if w in hand: probs.append("hand-written already (demo_words.txt wins): drop it")
    if w not in lex: probs.append("not in data/lexicon.tsv")
    if w in EXCLUDED: probs.append("excluded word")
    seen.add(w)
    keys = [re.match(r"(\w+)[=*+]", t).group(1) for t in rest.split() if re.match(r"(\w+)[=*+]", t)]
    twice = sorted({k for k in keys if keys.count(k) > 1})
    if twice: probs.append(f"sets {', '.join(twice)} more than once")
    for t in rest.split():
        mm = re.fullmatch(r"(\w+)([=*+])(.+)", t)
        if not mm or mm.group(1) not in props: probs.append(f"bad token {t}"); continue
        pid, op, val = mm.groups(); p = props[pid]
        num = p["type"] in ("num", "scale", "frac")
        if op != "=" and not num: probs.append(f"{t}: {op} needs a number property")
        elif num and val != "ABS":
            try: float(val)
            except ValueError: probs.append(f"{t}: not a number")
        elif p["type"] == "bool" and val not in ("true", "false"): probs.append(f"{t}: not a bool")
        elif p["type"] == "enum" and val not in p["values"]: probs.append(f"{t}: not one of {p['values']}")
    if probs: bad += 1; print(f"{n} {w}: " + "; ".join(probs))
    else: good += 1
print(f"{good} good entries, {bad} with problems")
