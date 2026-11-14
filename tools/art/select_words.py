"""Picks the words to draw for the generated-art run and writes tools/art/words.tsv.

The N most frequent words (zipf in data/lexicon.tsv) in data/demo.json that have no hand-made
shape (WORDS in client/src/art/shapes.ts), skipping words that keep a placard or rosette
(abstract, event, weather, verb and adjective words) and plurals of a word already in the list.
Each row carries the game data the prompt is written from, and the WordNet glosses as hints.

    python3 tools/art/select_words.py <wordnet dict dir> [N=3000]
"""
import json, os, subprocess, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from wn import WordNet

# Classes drawn as a picture of a thing; terrain only where it is an object you can picture.
DRAWN = {'artifact', 'person', 'creature', 'flora', 'material', 'consumable', 'bodypart'}
TERRAIN = {'landform', 'water', 'celestial', 'natural_object', 'elevation'}
LEX = {'artifact': {'noun.artifact'}, 'person': {'noun.person'}, 'creature': {'noun.animal', 'noun.person'},
       'flora': {'noun.plant', 'noun.food'}, 'consumable': {'noun.food', 'noun.substance'}, 'material': {'noun.substance', 'noun.artifact', 'noun.object'},
       'bodypart': {'noun.body', 'noun.animal'}, 'terrain': {'noun.object', 'noun.location', 'noun.substance'}}

def skip_reason(d):
    if d['role'] != 'noun': return d['role']
    if d['class'] == 'terrain': return None if d['archetype'] in TERRAIN else 'terrain:' + d['archetype']
    return None if d['class'] in DRAWN else d['class']

def facts(s):
    out = []
    for k, v in s.items():
        if isinstance(v, list): v = ','.join(map(str, v))
        elif isinstance(v, float) and v.is_integer(): v = int(v)
        out.append(f'{k}={v}')
    return ' '.join(out)

def singular(w, demo):
    for cut, add in (('ies', 'y'), ('es', ''), ('s', '')):
        if w.endswith(cut) and w[:-len(cut)] + add in demo: return w[:-len(cut)] + add
    return None

def main():
    wn = WordNet(sys.argv[1]); n_want = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    demo = json.load(open(os.path.join(ROOT, 'data/demo.json')))
    lex = {}
    for line in open(os.path.join(ROOT, 'data/lexicon.tsv')):
        p = line.rstrip('\n').split('\t')
        if p[0] != 'word': lex[p[0]] = (float(p[4]), p[6])
    shaped = set(subprocess.run(['npx', 'tsx', 'tools/art/shape_keys.ts'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split())
    words = sorted((w for w in demo if w not in shaped), key=lambda w: (-lex.get(w, (0, ''))[0], w))
    skipped, rows, aliases = collections.Counter(), [], []
    for w in words:
        if len(rows) >= n_want: break
        d = demo[w]
        r = skip_reason(d)
        if r: skipped[r] += 1; continue
        one = singular(w, demo)
        if one and demo[one]['class'] == d['class']:
            aliases.append((w, one)); skipped['plural'] += 1; continue
        zipf, syn = lex.get(w, (0, ''))
        s = wn.syn.get((syn[:1], syn[1:])) if syn else None
        gloss = s.gloss.split(';')[0].strip() if s else ''
        ok = bool(s) and s.lex in LEX.get(d['class'], set())
        others = []
        for off in wn.index.get(w, {}).get('n', [])[:6]:
            o = wn.syn.get(('n', off))
            if o and o is not s and o.lex in LEX.get(d['class'], set()): others.append(o.gloss.split(';')[0].strip())
        rows.append([w, f'{zipf:.2f}', d['class'], d['archetype'], facts(d['set']), gloss, 'yes' if ok else 'no', ' | '.join(others[:3])])
    with open(os.path.join(ROOT, 'tools/art/words.tsv'), 'w') as f:
        f.write('word\tzipf\tclass\tarchetype\tfacts\tgloss\tgloss_class_matches\tother_senses\n')
        for r in rows: f.write('\t'.join(x.replace('\t', ' ') for x in r) + '\n')
    with open(os.path.join(ROOT, 'tools/art/aliases.tsv'), 'w') as f:
        f.write('word\tuses_art_of\n')
        for a, b in aliases: f.write(f'{a}\t{b}\n')
    print(len(rows), 'words;', sum(skipped.values()), 'skipped:', dict(skipped.most_common()))

if __name__ == '__main__':
    main()
