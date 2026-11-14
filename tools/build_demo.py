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

# PLAN.md "Letter economy": the letters a thing you own may produce (producers.txt), and what each
# needs when a line gives no production_needs of its own (shared produce.ts reads them).
PRODUCED = "ABCIMNPWYOGU"
NEEDS = {"A": ["tilled", "water"], "P": ["water", "harvest"], "W": ["wind"], "M": ["vowel", "vowel"],
         "C": ["labor"], "B": ["claim"], "O": ["extract"], "G": ["extract"], "U": ["extract"]}

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

def producers(out, props, errors):
    """Every word's produce_* values come from producers.txt alone (PLAN.md "Letter economy")."""
    for v in out.values():
        for k in [k for k in v["set"] if k.startswith("produce_") or k == "production_needs"]:
            del v["set"][k]
    lines = {}
    for n, line in enumerate(open(os.path.join(HERE, "producers.txt")), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        w, _, rest = line.partition(":")
        w = w.strip()
        if w not in out:
            errors.append(f"producers.txt:{n} {w}: not in the dictionary"); continue
        for t in rest.split():
            m = re.fullmatch(r"(\w+)=(.+)", t)
            if not m or m.group(1) not in props:
                errors.append(f"producers.txt:{n} {w}: bad token {t}"); continue
            pid, val = m.groups()
            p = props[pid]
            if pid == "produce_T" and out[w]["archetype"] != "exchange":
                errors.append(f"producers.txt:{n} {w}: only an exchange completes a trade for T"); continue
            if pid.startswith("produce_") and pid[-1] not in PRODUCED + "T":
                errors.append(f"producers.txt:{n} {w}: {pid[-1]} does not come from things (PLAN.md)"); continue
            if p["type"] in ("num", "scale", "frac"):
                val = float(val)
            elif p["type"] == "bool":
                val = val == "true"
            elif p["type"] == "tags":
                val = val.split(",")
            elif p["type"] == "enum" and val not in p["values"]:
                errors.append(f"producers.txt:{n} {w}: {t}: not one of {p['values']}"); continue
            lines.setdefault(w, {})[pid] = val
    for w, sets in lines.items():
        out[w]["set"].update(sets)
        made = [k[-1] for k in sets if k.startswith("produce_")]
        if made and "production_needs" not in sets:
            needs = [n for ch in made for n in NEEDS.get(ch, [])]
            if needs:
                out[w]["set"]["production_needs"] = list(dict.fromkeys(needs)) if "vowel" not in needs else needs

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
    # A comparative or superlative of a known adjective uses that adjective at a higher degree,
    # so a generated entry of its own (BIGGER) is not wanted.
    adjectives = {w for _, w, role, _, _ in entries if role == "adjective"}
    graded = {}
    for line in list(open(os.path.join(D, "inflections.tsv")))[1:]:
        form, base, degree, _ = line.rstrip("\n").split("\t")
        if base in adjectives:
            graded[form] = base
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
        if not strict and w in graded and role == "adjective":
            err(f"a degree of {graded[w].upper()}, which it follows", True); continue
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
                # Letters come from producers.txt alone: a generated word may scale what is earned
                # (WAR's K*3) but never adds a letter of its own (a verb that "earns" T).
                if not strict and op == "+" and pid.startswith("produce_"):
                    err(f"{t}: letters come from producers.txt alone"); continue
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
    producers(out, props, errors)
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
