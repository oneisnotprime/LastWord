"""Minimal WordNet 3.x dict-file reader (no dependencies)."""
import os, collections

LEXNAMES = ("adj.all adj.pert adv.all noun.Tops noun.act noun.animal noun.artifact noun.attribute "
 "noun.body noun.cognition noun.communication noun.event noun.feeling noun.food noun.group "
 "noun.location noun.motive noun.object noun.person noun.phenomenon noun.plant noun.possession "
 "noun.process noun.quantity noun.relation noun.shape noun.state noun.substance noun.time "
 "verb.body verb.change verb.cognition verb.communication verb.competition verb.consumption "
 "verb.contact verb.creation verb.emotion verb.motion verb.perception verb.possession "
 "verb.social verb.stative verb.weather adj.ppl").split()
POS = {"noun": "n", "verb": "v", "adj": "a", "adv": "r"}

class Synset:
    __slots__ = ("offset", "pos", "lex", "words", "hypernyms", "instance", "gloss")

class WordNet:
    def __init__(self, dict_dir):
        self.syn = {}                                   # (pos, offset) -> Synset
        self.index = collections.defaultdict(dict)      # lemma -> pos -> [offsets by sense rank]
        for name, p in POS.items():
            with open(os.path.join(dict_dir, "data." + name), encoding="latin-1") as f:
                for line in f:
                    if line.startswith("  "):
                        continue
                    head, _, gloss = line.partition("|")
                    t = head.split()
                    s = Synset()
                    s.offset, s.pos, s.lex = t[0], p, LEXNAMES[int(t[1])]
                    n = int(t[3], 16)
                    s.words = [t[4 + 2 * i] for i in range(n)]
                    i = 4 + 2 * n
                    pc = int(t[i]); i += 1
                    s.hypernyms, s.instance = [], False
                    for _ in range(pc):
                        sym, off, tp = t[i], t[i + 1], t[i + 2]
                        i += 4
                        if sym in ("@", "@i") and tp == "n" and p == "n":
                            s.hypernyms.append(off)
                        if sym == "@i":
                            s.instance = True
                    s.gloss = gloss.strip()
                    self.syn[(p, s.offset)] = s
            with open(os.path.join(dict_dir, "index." + name), encoding="latin-1") as f:
                for line in f:
                    if line.startswith("  "):
                        continue
                    t = line.split()
                    cnt = int(t[2])
                    self.index[t[0]][p] = t[-cnt:]
        self.tags = {}                                  # (lemma, pos) -> tag count of top sense
        num = {"1": "n", "2": "v", "3": "a", "4": "r", "5": "a"}
        with open(os.path.join(dict_dir, "index.sense"), encoding="latin-1") as f:
            for line in f:
                key, off, sn, tc = line.split()
                lemma, rest = key.split("%")
                k = (lemma, num[rest[0]])
                self.tags[k] = self.tags.get(k, 0) + int(tc)

    def senses(self, lemma, pos):
        return [self.syn[(pos, o)] for o in self.index.get(lemma, {}).get(pos, [])]

    def closure(self, s):
        """All hypernym ancestors of noun synset s, nearest first (BFS)."""
        out, seen, q = [], {s.offset}, [s]
        while q:
            nxt = []
            for x in q:
                for o in x.hypernyms:
                    if o not in seen:
                        seen.add(o); h = self.syn[("n", o)]; out.append(h); nxt.append(h)
            q = nxt
        return out
