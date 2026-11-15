#!/usr/bin/env python3
"""Write client/public/words/lexicon.json for the word browser (client/words.html).

usage: build_words_page.py [<wordnet dict dir>]

One entry per playable word in data/demo.json: [zipf, tier, gloss] from data/lexicon.tsv and the
WordNet gloss of its sense (blank without a dict dir). Rerun after the word data changes; a word
missing from the file still shows on the page, without frequency or gloss.
"""
import csv, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "client", "public", "words", "lexicon.json")
POS = {"n": "noun", "v": "verb", "a": "adj", "s": "adj", "r": "adv"}


def glosses(dict_dir, wanted):
    """(pos letter, offset) -> gloss, read straight from WordNet's data files."""
    out = {}
    for p, name in (("n", "noun"), ("v", "verb"), ("a", "adj"), ("r", "adv")):
        offs = wanted.get(p)
        if not offs:
            continue
        with open(os.path.join(dict_dir, "data." + name), encoding="latin-1") as f:
            for line in f:
                if line.startswith("  "):
                    continue
                off = line[:8]
                if off in offs:
                    out[(p, off)] = re.split(r';\s*"', line.partition("|")[2])[0].strip()  # the definition, not the examples
    return out


def main():
    words = json.load(open(os.path.join(DATA, "demo.json")))
    lex = {}
    with open(os.path.join(DATA, "lexicon.tsv"), encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            if row["word"] in words:
                lex.setdefault(row["word"], row)
    wanted = {}
    for row in lex.values():
        s = row["synset"]
        if len(s) == 9:
            wanted.setdefault(s[0], set()).add(s[1:])
    gl = glosses(sys.argv[1], wanted) if len(sys.argv) > 1 else {}
    out = {}
    for w in sorted(words):
        row = lex.get(w)
        if not row:
            continue
        s = row["synset"]
        gloss = gl.get((s[0], s[1:]), "") if len(s) == 9 else ""
        out[w] = [float(row["zipf"]), row["tier"], gloss]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{OUT}: {len(out)} words, {sum(1 for v in out.values() if v[2])} glosses, {os.path.getsize(OUT):,} bytes")


if __name__ == "__main__":
    main()
