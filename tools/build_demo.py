#!/usr/bin/env python3
"""Check the word property files against the schema and write ../data/demo.json.

Two sources: demo_words.txt, written by hand and checked strictly (any error fails the build),
and generated_words.txt, written by generate_words.py and checked leniently (a bad token is
dropped, a word that cannot be placed is skipped, and both are counted). Hand-written words win.

build_demo.py --overrides   add each word's role and archetype to overrides.tsv
build_demo.py               validate against properties.json and lexicon.tsv, write demo.json
"""
import os, re, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "..", "data")

SOURCES = (("demo_words.txt", True), ("generated_words.txt", False))

def parse(name="demo_words.txt"):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        return
    role = arch = None
    for n, line in enumerate(open(path), 1):
        line = line.strip()
        m = re.fullmatch(r"# (noun|verb|adjective|adverb) (\w+)", line)
        if m:
            role, arch = m.groups()
        elif line and not line.startswith("#"):
            word, _, rest = line.partition(":")
            yield n, word.strip(), role, arch, rest.split()

def entries_all():
    """(line, word, role, archetype, tokens, strict) from both sources; hand-written words first."""
    seen = set()
    for name, strict in SOURCES:
        for n, w, role, arch, toks in parse(name):
            if w in seen and not strict:
                continue
            seen.add(w)
            yield (f"{name}:{n}", w, role, arch, toks, strict)

def main():
    entries = [e[:5] for e in entries_all()]
    strictness = {e[1]: e[5] for e in entries_all()}
    if "--overrides" in sys.argv:
        path = os.path.join(D, "overrides.tsv")
        over = {l.split("\t")[0]: l.rstrip("\n").split("\t") for l in list(open(path))[1:]}
        for _, w, role, arch, _ in entries:
            over[w] = [w, role, arch]
        with open(path, "w") as f:
            f.write("word\trole\tarchetype\n")
            for w in sorted(over):
                f.write("\t".join((over[w] + [""])[:3]) + "\n")
        return print("overrides:", len(over))

    props = {p["id"]: p for p in json.load(open(os.path.join(D, "properties.json")))["properties"]}
    lex = {l.split("\t")[0]: l.split("\t")[1:4] for l in list(open(os.path.join(D, "lexicon.tsv")))[1:]}
    errors, out, seen = [], {}, set()
    dropped, skipped = [], []
    for n, w, role, arch, toks in entries:
        strict = strictness[w]
        def err(msg, word_level=False):
            if strict:
                errors.append(f"line {n} {w}: {msg}")
            elif word_level:
                skipped.append(f"{w}: {msg}")
            else:
                dropped.append(f"{w}: {msg}")
        if w in seen:
            err("duplicate", True); continue
        seen.add(w)
        if w not in lex:
            err("not in lexicon", True); continue
        if lex[w][0] != role or lex[w][2] != arch:
            err(f"lexicon has {lex[w]}", True)
            if not strict: continue
        sets, ops = {}, []
        for t in toks:
            m = re.fullmatch(r"(\w+)([=*+])(.+)", t)
            if not m or m.group(1) not in props:
                err(f"bad token {t}"); continue
            pid, op, val = m.groups()
            p = props[pid]
            numeric = p["type"] in ("num", "scale", "frac")
            if op != "=":
                if not numeric:
                    err(f"{t}: {op} needs a numeric property"); continue
                try: ops.append([pid, "mul" if op == "*" else "add", float(val)])
                except ValueError: err(f"{t}: not a number")
            elif val == "ABS" and numeric:
                sets[pid] = "ABS"
            elif numeric:
                try: sets[pid] = float(val)
                except ValueError: err(f"{t}: not a number")
            elif p["type"] == "bool":
                if val not in ("true", "false"): err(f"{t}: not a bool"); continue
                sets[pid] = val == "true"
            elif p["type"] == "enum":
                if val not in p["values"]: err(f"{t}: not one of {p['values']}"); continue
                sets[pid] = val
            elif p["type"] == "tags":
                sets[pid] = val.split(",")
            else:
                if pid in ("contest_with", "contested_by", "field_property", "effect_property") and val not in props:
                    err(f"{t}: {val} is not a property"); continue
                sets[pid] = val
        out[w] = {"role": role, "class": lex[w][1], "archetype": arch, "set": sets, "ops": ops}
    if dropped or skipped:
        with open(os.path.join(HERE, "..", "data", "generated_problems.txt"), "w") as f:
            f.write("# Words skipped and tokens dropped from generated_words.txt by build_demo.py\n")
            f.write("\n".join(["## skipped words"] + skipped + ["", "## dropped tokens"] + dropped) + "\n")
        print(f"generated: {len(skipped)} words skipped, {len(dropped)} tokens dropped (see data/generated_problems.txt)")
    if errors:
        print("\n".join(errors)); sys.exit(1)
    json.dump(out, open(os.path.join(D, "demo.json"), "w"), indent=0, separators=(",", ":"))
    # Comparatives and superlatives of demo adjectives, unless the form is itself a demo word.
    infl = {}
    for line in list(open(os.path.join(D, "inflections.tsv")))[1:]:
        form, base, degree, _ = line.rstrip("\n").split("\t")
        if base in out and out[base]["role"] == "adjective" and form not in out:
            infl[form] = [base, degree]
    json.dump(infl, open(os.path.join(D, "demo_inflections.json"), "w"), indent=0, separators=(",", ":"))
    by = {}
    for v in out.values():
        by[v["class"]] = by.get(v["class"], 0) + 1
    used = {k for v in out.values() for k in v["set"]} | {o[0] for v in out.values() for o in v["ops"]}
    print(len(out), "words", by); print("properties used:", len(used), "of", len(props))

if __name__ == "__main__":
    main()
