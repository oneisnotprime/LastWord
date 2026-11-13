#!/usr/bin/env python3
"""Check demo_words.txt against the schema and write ../data/demo.json.

build_demo.py --overrides   add each demo word's role and archetype to overrides.tsv
build_demo.py               validate against properties.json and lexicon.tsv, write demo.json
"""
import os, re, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "..", "data")

def parse():
    role = arch = None
    for n, line in enumerate(open(os.path.join(HERE, "demo_words.txt")), 1):
        line = line.strip()
        m = re.fullmatch(r"# (noun|verb|adjective|adverb) (\w+)", line)
        if m:
            role, arch = m.groups()
        elif line and not line.startswith("#"):
            word, _, rest = line.partition(":")
            yield n, word.strip(), role, arch, rest.split()

def main():
    entries = list(parse())
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
    for n, w, role, arch, toks in entries:
        err = lambda msg: errors.append(f"line {n} {w}: {msg}")
        if w in seen:
            err("duplicate")
        seen.add(w)
        if w not in lex:
            err("not in lexicon")
        elif lex[w][0] != role or lex[w][2] != arch:
            err(f"lexicon has {lex[w]}")
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
                ops.append([pid, "mul" if op == "*" else "add", float(val)])
            elif val == "ABS" and numeric:
                sets[pid] = "ABS"
            elif numeric:
                try: sets[pid] = float(val)
                except ValueError: err(f"{t}: not a number")
            elif p["type"] == "bool":
                if val not in ("true", "false"): err(f"{t}: not a bool")
                sets[pid] = val == "true"
            elif p["type"] == "enum":
                if val not in p["values"]: err(f"{t}: not one of {p['values']}")
                sets[pid] = val
            elif p["type"] == "tags":
                sets[pid] = val.split(",")
            else:
                if pid in ("contest_with", "contested_by", "field_property", "effect_property") and val not in props:
                    err(f"{t}: {val} is not a property")
                sets[pid] = val
        out[w] = {"role": role, "class": lex.get(w, ["", "", ""])[1], "archetype": arch, "set": sets, "ops": ops}
    if errors:
        print("\n".join(errors)); sys.exit(1)
    json.dump(out, open(os.path.join(D, "demo.json"), "w"), indent=0, separators=(",", ":"))
    by = {}
    for v in out.values():
        by[v["class"]] = by.get(v["class"], 0) + 1
    used = {k for v in out.values() for k in v["set"]} | {o[0] for v in out.values() for o in v["ops"]}
    print(len(out), "words", by); print("properties used:", len(used), "of", len(props))

if __name__ == "__main__":
    main()
