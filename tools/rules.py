"""Generator rules: properties given to every word whose meaning matches (tools/rules.txt).

build_demo.py applies them after demo_words.txt and generated_words.txt, so a whole meaning hooks
into a shared system at once (every leader raises command, every act of peace holds the storm
wall), not a handful of hand-picked words. A word keeps any value it already sets.

rules.txt holds blocks:

    rule <name>
    when <condition> <condition> ...     all must hold; several `when` lines are alternatives
    not <condition> ...                  a word matching any `not` line is left out
    set <token> <token> ...              demo_words.txt tokens: p=v, p*x, p+x

Conditions:
    word=a,b,c          the word itself
    name=<regex>        the word matches (whole word)
    under=a,b           its WordNet sense, or any sense above it, has one of these lemmas
    gloss=<regex>       its WordNet gloss matches (case-insensitive, searched)
    role=, class=, arch=   lexicon role, class or archetype (comma: any of them)
    has=p,q             it sets one of these itself (non-zero, true, non-empty) or changes it
    no=p,q              it neither sets nor changes any of these
    tag=p:v             its tags property p includes v
    is=p:v|w            its own value of p is one of these (empty: unset)
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))


def load(path=os.path.join(HERE, "rules.txt")):
    rules, cur = [], None
    for n, line in enumerate(open(path), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        head, _, rest = line.partition(" ")
        if head == "rule":
            cur = {"name": rest.strip(), "when": [], "not": [], "set": [], "line": n}
            rules.append(cur)
        elif head in ("when", "not"):
            cur[head].append(parse_conditions(rest, n))
        elif head == "set":
            cur["set"].extend(rest.split())
        else:
            raise SystemExit(f"rules.txt:{n}: unknown line {line!r}")
    return rules


def parse_conditions(text, n):
    out = []
    for tok in re.findall(r"\S+", text):
        k, eq, v = tok.partition("=")
        if not eq or k not in ("word", "name", "under", "gloss", "role", "class", "arch", "has", "no", "tag", "is"):
            raise SystemExit(f"rules.txt:{n}: bad condition {tok}")
        out.append((k, v))
    return out


class Meaning:
    """WordNet sense, ancestors and gloss of each lexicon word (None without a WordNet dir)."""

    def __init__(self, dict_dir, lexicon):
        self.wn = None
        self.lex = lexicon
        if dict_dir and os.path.isdir(dict_dir):
            from wn import WordNet
            self.wn = WordNet(dict_dir)
        self.cache = {}

    def sense(self, word):
        if not self.wn:
            return None
        syn = self.lex.get(word, [None] * 6)[5] if word in self.lex else None
        if not syn or syn == "-":
            return None
        pos = {"s": "a"}.get(syn[0], syn[0])
        return self.wn.syn.get((pos, syn[1:]))

    def lemmas_above(self, word):
        if word in self.cache:
            return self.cache[word]
        s = self.sense(word)
        out = set()
        if s:
            out.update(w.lower() for w in s.words)
            if s.pos == "n":
                for h in self.wn.closure(s):
                    out.update(w.lower() for w in h.words)
        self.cache[word] = out
        return out

    def gloss(self, word):
        s = self.sense(word)
        return s.gloss if s else ""


def sets(entry, p):
    v = entry["set"].get(p)
    return (v not in (None, False, 0, 0.0, "", []) ) or any(o[0] == p for o in entry["ops"])


def matches(word, entry, conds, meaning):
    for k, v in conds:
        alts = v.split(",")
        if k == "word" and word not in alts: return False
        if k == "name" and not re.fullmatch(v, word): return False
        if k == "role" and entry["role"] not in alts: return False
        if k == "class" and entry["class"] not in alts: return False
        if k == "arch" and entry["archetype"] not in alts: return False
        if k == "has" and not any(sets(entry, p) for p in alts): return False
        if k == "no" and any(sets(entry, p) for p in alts): return False
        if k == "tag":
            p, _, t = v.partition(":")
            tags = entry["set"].get(p)
            if not isinstance(tags, list) or t not in tags: return False
        if k == "is":
            p, _, vals = v.partition(":")
            got = entry["set"].get(p)
            if str(got if got is not None else "") not in vals.split("|"): return False
        if k == "under" and not (meaning.lemmas_above(word) & set(alts)): return False
        if k == "gloss" and not re.search(v, meaning.gloss(word), re.I): return False
    return True


def apply(out, props, meaning, parse_token, errors, report=None):
    """Adds each rule's tokens to every word it matches, unless the word already has the property."""
    counts = {}
    for rule in load():
        hit = 0
        toks = []
        for t in rule["set"]:
            got = parse_token(t)
            if isinstance(got, str):
                errors.append(f"rules.txt:{rule['line']} {rule['name']}: {got}")
            else:
                toks.append(got)
        for w, e in out.items():
            if not any(matches(w, e, c, meaning) for c in rule["when"]):
                continue
            if any(matches(w, e, c, meaning) for c in rule["not"]):
                continue
            added = False
            for kind, pid, val in toks:
                if sets(e, pid):
                    continue
                if kind == "set":
                    e["set"][pid] = val
                else:
                    e["ops"].append([pid, kind, val])
                added = True
            if added:
                hit += 1
                if report is not None:
                    report.setdefault(rule["name"], []).append(w)
        counts[rule["name"]] = hit
    return counts
