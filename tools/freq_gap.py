#!/usr/bin/env python3
"""The frequency gap: the most common English words that are not playable yet.

    python tools/freq_gap.py                 counts for the top 10k, 20k and 30k, by part of speech
    python tools/freq_gap.py --todo 3000     also write tools/freq_todo.txt, the next missing words
    (WordNet from node_modules/wordnet-db/dict, or the directory in $WORDNET_DICT)

A word is playable when it has data in data/demo.json (hand-written or generated); its plural,
comparative or superlative is then playable too. The ranking is wordfreq's English list. A word
counts toward the gap when it is a dictionary headword (data/lexicon.tsv or data/inert.tsv) with no
data, and has three letters or more and is not a function word, a name, an inflection WordNet misreads, a crude word (tools/crude.txt), a proper noun (data/proper.tsv),
a word WordNet only knows capitalized (JUNE, FRIDAY, GOOGLE), a plural headword whose singular
is a headword too (YEARS: counted as YEAR), or a word kept out on purpose (generate_words.py
EXCLUDED). Needs `pip install wordfreq`.
"""
import collections, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
sys.path.insert(0, HERE)
from generate_words import GRAMMAR, EXCLUDED  # noqa: E402
from wn import WordNet  # noqa: E402

# Function words WordNet happens to list (I as iodine, A as a vitamin, WILL as a testament).
FUNCTION = GRAMMAR | set("""
a an the i me my mine we us our ours you your yours he him his she her hers it its they their
theirs of in on at by for with from to up down off out as if or and nor so than that because
be am is are was were been being do does did have has had will would can could shall should may
might must ought no not yes ok oh ah eh um uh hey hi hello bye wow ha lol non pro anti per vs
mr mrs ms dr st co inc ltd re la ii iii iv vi vii viii ix xi xii etc thou thee thy
""".split())
# Names WordNet also lists lower-case (GOOGLE as a verb, JOSH as to tease): counted as names.
NAMES = set("""google josh franklin wright turner ken benjamin costa murphy brad warner harper
shanghai superman troy chad randy gilbert ana easter thanksgiving
beth burke donna ira rand tucker chapman timothy somerset jenny molly benedict brent monte
clarence maxwell lambert silva dell congo beck""".split())
# Headwords whose common use is an inflection or an abbreviation WordNet reads as something else
# (LIED as a German song, SHOOK as a sheaf, MPH, GEN, CHI): left out of the gap.
NOT_WORDS = set("lied shook tops mph neo gen sen chi col sang wont dug comp para mil das sol tore".split())




def capitalized_only(wn):
    """Lemmas WordNet lists only with a capital letter, in every sense: names of months, days, firms."""
    seen = collections.defaultdict(set)
    for s in wn.syn.values():
        for w in s.words:
            base = w.split("(")[0]
            seen[base.lower()].add(base[:1].isupper())
    return {w for w, caps in seen.items() if caps == {True}}


ROLES = ("noun", "verb", "adjective", "adverb")


def rows(path):
    return [l.rstrip("\n").split("\t") for l in list(open(path))[1:]]


def singular_forms(w):
    out = []
    if w.endswith("ies"): out.append(w[:-3] + "y")
    if w.endswith("es"): out.append(w[:-2])
    if w.endswith("s") and not w.endswith("ss"): out.append(w[:-1])
    return out


def gap(top=30000):
    from wordfreq import top_n_list, zipf_frequency
    demo = json.load(open(os.path.join(DATA, "demo.json")))
    played = set(demo)
    for form, base, *_ in rows(os.path.join(DATA, "inflections.tsv")):
        if base in played:
            played.add(form)
    head = {}
    for r in rows(os.path.join(DATA, "lexicon.tsv")):
        head[r[0]] = r[1]
    for r in rows(os.path.join(DATA, "inert.tsv")):
        head.setdefault(r[0], r[1])
    proper = {r[0] for r in rows(os.path.join(DATA, "proper.tsv"))}
    dict_dir = os.environ.get("WORDNET_DICT", os.path.join(HERE, "..", "node_modules", "wordnet-db", "dict"))
    proper |= capitalized_only(WordNet(dict_dir))
    crude = {l.split()[0] for l in open(os.path.join(HERE, "crude.txt")) if l.strip() and not l.startswith("#")}
    out = []
    for rank, w in enumerate(top_n_list("en", top), 1):
        if not re.fullmatch(r"[a-z]{3,}", w) or w in played or w in FUNCTION or w in NAMES or w in NOT_WORDS or w in crude:
            continue
        if w in proper or w in EXCLUDED or w not in head:
            continue
        if head[w] == "noun" and any(s in head for s in singular_forms(w)):
            continue
        out.append((rank, w, head[w], zipf_frequency(w, "en")))
    return out


def main():
    missing = gap()
    print("missing headwords among wordfreq's top N, by part of speech")
    for n in (10000, 20000, 30000):
        c = collections.Counter(r[2] for r in missing if r[0] <= n)
        print(f"  top {n // 1000}k: {sum(c.values()):5d}  " + "  ".join(f"{k} {c.get(k, 0)}" for k in ROLES))
    if "--todo" in sys.argv:
        n = int(sys.argv[sys.argv.index("--todo") + 1])
        with open(os.path.join(HERE, "freq_todo.txt"), "w") as f:
            f.write("# The next most common words with no game data, written by tools/freq_gap.py --todo.\n"
                    "# rank (wordfreq English), word, part of speech, zipf\n")
            for rank, w, role, z in missing[:n]:
                f.write(f"{rank}\t{w}\t{role}\t{z:.2f}\n")
        print(f"wrote {min(n, len(missing))} words to tools/freq_todo.txt")


if __name__ == "__main__":
    main()
