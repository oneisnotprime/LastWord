"""Generated word art: prompts from game data, Z-Image-Turbo candidates, cut-out, QC, palette snap.

Work files (downloads, candidates, sheets) go in $ART_WORK, never in the repo. Run every step
with `python3 -I` because it reads downloaded images. See docs/ART_PIPELINE.md.

    pipeline.py prompts                 subjects*.tsv + words.tsv -> $ART_WORK/prompts.tsv
    pipeline.py generate [words...]     4 seeds per word -> $ART_WORK/raw/<word>/<seed>.png
    pipeline.py qc                      local cut-out + checks -> $ART_WORK/qc.json
    pipeline.py sheets <n> [words...]   contact sheets for judging -> $ART_WORK/sheets/
    pipeline.py finish                  picks.tsv -> BiRefNet cut-out, crop, snap, 128 px WebP
                                        -> client/public/art/words/ + manifest.json
"""
import concurrent.futures as cf, hashlib, io, json, os, re, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import fal  # noqa: E402

WORK = os.environ.get('ART_WORK') or sys.exit('set ART_WORK to a work folder outside the repo')
OUT = os.path.join(ROOT, 'client/public/art/words')

# Frozen generation settings: the pilot's a2 route minus the "dot eyes" clause.
MODEL = 'fal-ai/z-image/turbo'
LORA_MODEL = 'fal-ai/z-image/turbo/lora'
SIZE = int(os.environ.get('ART_SIZE', 640))
STEPS = 8
SEEDS = [11, 22, 33, 44]
RETRY_SEEDS = [55, 66, 77, 88]
# The style LoRA trained on 60 flat renders of the hand-made shapes (see docs/ART_PIPELINE.md); ART_LORA=none for none.
LORA = os.environ.get('ART_LORA', 'https://v3b.fal.media/files/b/0ab27d53/eQwXLy7zc81yX2BC8UQtH_pytorch_lora_weights.safetensors')
LORA = '' if LORA == 'none' else LORA
LORA_SCALE = float(os.environ.get('ART_LORA_SCALE', 1))
TRIGGER = 'lwpaper '
PRICE = {MODEL: 0.005, LORA_MODEL: 0.0085}      # $ per megapixel, at least 1 MP an image (fal, Nov 2026)
BIREFNET = 'fal-ai/birefnet/v2'
BIREFNET_PRICE = 0.001                          # upper estimate per image (billed per compute second)
TEMPLATE = ('Simple flat paper cut-out token of {subject}. Side view, one chunky readable silhouette made of a handful '
            'of flat solid-colour paper shapes ({colours}) with clean straight-cut edges. No gradients, no texture, '
            'no shading, no outline. Centred on a plain white background, no shadow, no text, no frame.')
OUT_PX = 128                                   # longest side of the stored image


def tsv(path):
    rows = [l.rstrip('\n').split('\t') for l in open(path, encoding='utf-8') if l.strip()]
    return [dict(zip(rows[0], r)) for r in rows[1:]]


PALE = re.compile(r'^(white|cream|ivory|off-white|pale|snow|silver|light grey|light gray)')


def prompt_of(subject, colours, cls=''):
    subject = subject.rstrip('. ')
    # A white subject on white cannot be cut out: those get a mid grey background.
    grey = bool(PALE.match(colours.strip().lower()))
    # People and creatures came out as busts in the pilot: ask for the whole figure.
    if cls in ('person', 'creature') and 'full body' not in subject: subject += ', full body'
    text = TEMPLATE.format(subject=subject, colours=colours.strip())
    if grey: text = text.replace('plain white background', 'plain flat mid-grey background')
    return (TRIGGER if LORA else '') + text


# ---------------------------------------------------------------------------------------------
# Prompts

def cmd_prompts():
    """Joins the hand-written subjects (tools/art/subjects.tsv) to words.tsv; a retry line wins."""
    cls = {r['word']: r['class'] for r in tsv(os.path.join(HERE, 'words.tsv'))}
    words = list(cls)
    subj = {r['word']: r for r in tsv(os.path.join(HERE, 'subjects.tsv'))}
    retry = os.path.join(HERE, 'subjects_retry.tsv')
    retry = {r['word']: r for r in tsv(retry)} if os.path.exists(retry) else {}
    missing = [w for w in words if w not in subj]
    if missing: print('no subject for', len(missing), missing[:20])
    with open(os.path.join(WORK, 'prompts.tsv'), 'w') as f:
        f.write('word\tround\tprompt\n')
        for w in words:
            if w in subj: f.write(f"{w}\t1\t{prompt_of(subj[w]['subject'], subj[w]['colours'], cls[w])}\n")
            if w in retry: f.write(f"{w}\t2\t{prompt_of(retry[w]['subject'], retry[w]['colours'], cls[w])}\n")
    print('prompts written')


# ---------------------------------------------------------------------------------------------
# Generation

def gen_one(word, rnd, prompt, seed):
    d = os.path.join(WORK, 'raw', word)
    path = os.path.join(d, f'{seed}.png')
    if os.path.exists(path): return 0
    os.makedirs(d, exist_ok=True)
    args = {'prompt': prompt, 'image_size': {'width': SIZE, 'height': SIZE}, 'num_inference_steps': STEPS, 'seed': seed,
            'num_images': 1, 'output_format': 'png', 'enable_safety_checker': True}
    ep = MODEL
    if LORA:
        ep = LORA_MODEL
        args['loras'] = [{'path': LORA, 'scale': LORA_SCALE}]
    r = fal.run(ep, args)
    if 'images' not in r:
        print('fail', word, seed, r.get('body', '')[:200], flush=True); return 0
    for i in range(4):          # billed once made, so fetch it whatever the network does
        try:
            fal.fetch(r['images'][0]['url'], path); break
        except Exception as e:
            print('fetch retry', word, seed, str(e)[:100], flush=True); time.sleep(5 * (i + 1))
    return 1


def cmd_generate(only=None, rnd='1', budget=70.0):
    rows = [r for r in tsv(os.path.join(WORK, 'prompts.tsv')) if r['round'] == rnd and (not only or r['word'] in only)]
    seeds = SEEDS if rnd == '1' else RETRY_SEEDS
    jobs = [(r['word'], rnd, r['prompt'], s) for r in rows for s in seeds
            if not os.path.exists(os.path.join(WORK, 'raw', r['word'], f'{s}.png'))]
    unit = PRICE[LORA_MODEL if LORA else MODEL] * max(1.0, SIZE * SIZE / 1e6)   # fal bills at least 1 MP an image
    if fal.spent() + len(jobs) * unit > budget: sys.exit(f'would exceed budget: {fal.spent():.2f} + {len(jobs)} x {unit:.4f}')
    print(len(jobs), 'images at', unit, flush=True)
    done = logged = 0
    try:
        with cf.ThreadPoolExecutor(10) as ex:   # fal allows 10 requests at once
            futs = [ex.submit(gen_one, *j) for j in jobs]
            for i, f in enumerate(cf.as_completed(futs)):
                try: done += f.result()
                except Exception as e: print('error', str(e)[:200], flush=True)
                if done - logged >= 200:
                    fal.log_cost(LORA_MODEL if LORA else MODEL, done - logged, unit, f'{SIZE}px, round {rnd}'); logged = done; print('done', i + 1, flush=True)
    finally:
        if done > logged: fal.log_cost(LORA_MODEL if LORA else MODEL, done - logged, unit, f'{SIZE}px, round {rnd}')
    print('generated', done)


# ---------------------------------------------------------------------------------------------
# Local cut-out and checks (on all candidates; free)

def dilate(m):
    o = m.copy()
    o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    return o


def white_bg(rgb, tol=22):
    """Background: pixels near the border's colour (white, or grey behind white subjects), connected to the border."""
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.int16)
    bg = np.median(edge, axis=0)
    near = np.abs(rgb.astype(np.int16) - bg).max(axis=2) < tol
    seed = np.zeros_like(near)
    seed[0, :] = near[0, :]; seed[-1, :] = near[-1, :]; seed[:, 0] = near[:, 0]; seed[:, -1] = near[:, -1]
    while True:
        nxt = dilate(seed) & near
        if (nxt == seed).all(): return seed
        seed = nxt


def labels(fg):
    """Connected components of a small mask: sizes, largest first, and the label image."""
    h, w = fg.shape
    lab = np.where(fg, np.arange(h * w).reshape(h, w), h * w)
    while True:
        m = lab.copy()
        m[1:] = np.minimum(m[1:], lab[:-1]); m[:-1] = np.minimum(m[:-1], lab[1:])
        m[:, 1:] = np.minimum(m[:, 1:], lab[:, :-1]); m[:, :-1] = np.minimum(m[:, :-1], lab[:, 1:])
        m = np.where(fg, m, h * w)
        if (m == lab).all(): break
        lab = m
    ids, counts = np.unique(lab[fg], return_counts=True)
    order = np.argsort(-counts)
    return ids[order], counts[order], lab


def checks(path):
    im = Image.open(path).convert('RGB').resize((160, 160), Image.LANCZOS)
    rgb = np.asarray(im)
    fg = ~white_bg(rgb)
    n = fg.size
    fill = fg.sum() / n
    out = {'fill': round(float(fill), 3)}
    if fill < 0.02: return {**out, 'ok': False, 'why': 'empty'}
    edge = np.concatenate([fg[0], fg[-1], fg[:, 0], fg[:, -1]]).mean()
    ys, xs = np.nonzero(fg)
    span = max(xs.max() - xs.min(), ys.max() - ys.min()) / 160
    ids, counts, _ = labels(fg)
    main = counts[0] / counts.sum()
    big = int((counts > counts[0] * 0.08).sum())
    # Colour count of the subject (a flat cut-out uses few colours).
    px = (rgb[fg] // 32).astype(np.int32)
    q = np.unique(px[:, 0] * 64 + px[:, 1] * 8 + px[:, 2], return_counts=True)[1]
    colours = int((q > fg.sum() * 0.02).sum())
    out.update(edge=round(float(edge), 3), span=round(float(span), 2), main=round(float(main), 3), parts=big, colours=colours)
    why, soft = [], []
    if edge > 0.06: why.append('touches edge')
    if fill > 0.7 or (span > 0.97 and fill > 0.5): why.append('framed or scene')
    if span < 0.25: why.append('tiny')
    # White parts on the white background split the local cut-out, so pieces only lower the score.
    if main < 0.7: soft.append('pieces')
    if big > 3: soft.append('scattered')
    out['ok'] = not why
    out['why'] = ', '.join(why + soft)
    # Higher is better: one solid piece, a sensible size, few colours.
    out['score'] = round(float(main - abs(fill - 0.3) - edge * 5 - max(0, colours - 7) * 0.05 - 0.2 * len(soft) - (0 if out['ok'] else 2)), 3)
    return out


def cmd_qc():
    qc_path = os.path.join(WORK, 'qc.json')
    qc = json.load(open(qc_path)) if os.path.exists(qc_path) else {}
    jobs = []
    for w in sorted(os.listdir(os.path.join(WORK, 'raw'))):
        for f in sorted(os.listdir(os.path.join(WORK, 'raw', w))):
            key = f'{w}/{f[:-4]}'
            if key not in qc: jobs.append((key, os.path.join(WORK, 'raw', w, f)))
    with cf.ProcessPoolExecutor() as ex:
        for key, r in zip([k for k, _ in jobs], ex.map(checks, [p for _, p in jobs], chunksize=16)):
            qc[key] = r
    json.dump(qc, open(qc_path, 'w'), indent=0)
    ok = sum(1 for v in qc.values() if v['ok'])
    print(len(qc), 'candidates checked,', ok, 'pass')


# ---------------------------------------------------------------------------------------------
# Contact sheets: each word's candidates, best first, at full size and at game size

def font(size):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def cmd_sheets(per=10, only=None, tag='judge'):
    qc = json.load(open(os.path.join(WORK, 'qc.json')))
    meta = {r['word']: r for r in tsv(os.path.join(HERE, 'words.tsv'))}
    rnd = os.environ.get('ART_ROUND', '1')
    seeds = SEEDS if rnd == '1' else RETRY_SEEDS
    subj = {r['word']: r for r in tsv(os.path.join(HERE, 'subjects.tsv' if rnd == '1' else 'subjects_retry.tsv'))}
    words = [w for w in meta if (w in subj) and os.path.isdir(os.path.join(WORK, 'raw', w)) and (not only or w in only)]
    d = os.path.join(WORK, 'sheets', tag); os.makedirs(d, exist_ok=True)
    F, f2 = font(15), font(11)
    C = 150
    index = []
    for si in range(0, len(words), per):
        chunk = words[si:si + per]
        sheet = Image.new('RGB', (C * 4 + 260, C * len(chunk)), '#f4efe2')
        dr = ImageDraw.Draw(sheet)
        for i, w in enumerate(chunk):
            cands = [f'{x}.png' for x in seeds if os.path.exists(os.path.join(WORK, 'raw', w, f'{x}.png'))]
            y = i * C
            dr.line([(0, y), (sheet.width, y)], fill='#b9a98a')
            m = meta[w]
            dr.text((6, y + 6), w.upper(), fill='#2b2a28', font=F)
            dr.text((6, y + 28), f"{m['class']} / {m['archetype']}", fill='#4a3f33', font=f2)
            s = subj.get(w, {}).get('subject', '')
            for li in range(0, min(len(s), 140), 34): dr.text((6, y + 46 + li // 34 * 14), s[li:li + 34], fill='#6a5a48', font=f2)
            for j, f in enumerate(cands[:4]):
                im = Image.open(os.path.join(WORK, 'raw', w, f)).convert('RGB').resize((C - 34, C - 34), Image.LANCZOS)
                x = 260 + j * C
                sheet.paste(im, (x, y + 4))
                small = im.resize((40, 40), Image.LANCZOS)          # about game size
                sheet.paste(small, (x + C - 34 - 40, y + C - 34 - 40 + 30))
                q = qc.get(f'{w}/{f[:-4]}', {})
                dr.text((x, y + C - 28), f"{'ABCD'[j]} {'ok' if q.get('ok') else 'X ' + q.get('why', '')[:14]}", fill='#2b2a28' if q.get('ok') else '#b03030', font=f2)
            index.append((w, si // per + 1))
        sheet.save(os.path.join(d, f'sheet_{si // per + 1:03d}.jpg'), quality=85)
    with open(os.path.join(d, 'index.tsv'), 'w') as f:
        f.write('word\tsheet\n' + ''.join(f'{w}\t{s}\n' for w, s in index))
    print(len(index), 'words on', (len(words) + per - 1) // per, 'sheets in', d)


# ---------------------------------------------------------------------------------------------
# Finish: cut out the pick with BiRefNet, crop, palette snap, 128 px WebP, manifest

def palette():
    src = open(os.path.join(ROOT, 'client/src/art/palette.ts')).read()
    body = src[src.index('export const MATERIAL'):src.index('const hex')]
    base = sorted(set(re.findall(r'#[0-9a-f]{6}', body)))
    def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
    out = []
    for h in base + ['#2b2a28', '#fbf7ec', '#f3d6b8', '#e0a890', '#a8704a', '#5a3a26']:   # eyes, paper, skin tones
        c = rgb(h)
        # The renderer's own shades of each colour (paper.ts inks): light, dark, deep.
        out += [c, c + (np.array([255, 250, 240]) - c) * 0.28, c + (np.array([42, 32, 24]) - c) * 0.22, c + (np.array([42, 32, 24]) - c) * 0.45]
    return np.unique(np.round(np.array(out)), axis=0)


PAL = None


def kmeans(px, k, it=12):
    rng = np.random.default_rng(0)
    c = px[rng.choice(len(px), min(k, len(px)), replace=False)].astype(float)
    for _ in range(it):
        a = ((px[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        for j in range(len(c)):
            if (a == j).any(): c[j] = px[a == j].mean(0)
    return c, a


def snap(rgba):
    """Crops to the subject, drops specks, scales to OUT_PX, snaps to the palette in 6 colours."""
    global PAL
    if PAL is None: PAL = palette()
    a = rgba[:, :, 3]
    ys, xs = np.nonzero(a > 128)
    if not len(xs): return None
    im = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    s = OUT_PX / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    arr = np.asarray(im).copy()
    fg = arr[:, :, 3] > 110
    ids, counts, lab = labels(fg)
    keep = np.isin(lab, ids[counts >= counts[0] * 0.02]) & fg
    px = arr[keep][:, :3].astype(float)
    sample = px[np.random.default_rng(1).choice(len(px), min(len(px), 4000), replace=False)]
    cent, _ = kmeans(sample, 6)
    snapped = PAL[((cent[:, None, :] - PAL[None]) ** 2).sum(-1).argmin(1)]
    assign = ((px[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
    arr[keep, :3] = snapped[assign].astype(np.uint8)
    arr[:, :, 3] = np.where(keep, 255, 0)
    # Crop again after dropping specks.
    ys, xs = np.nonzero(keep)
    arr = arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return arr


def birefnet(path):
    url = fal.upload(path, 'image/png')
    r = fal.run(BIREFNET, {'image_url': url, 'model': 'General Use (Light)', 'operating_resolution': '1024x1024', 'output_format': 'png'})
    if 'image' not in r: raise RuntimeError(str(r)[:300])
    buf = fal.S.get(r['image']['url'], timeout=120).content
    return np.asarray(Image.open(io.BytesIO(buf)).convert('RGBA'))


def local_cut(path, px=320):
    """Cut-out without a model: the background is the border's colour, flood-filled from the
    border at `px`, with a soft edge from each edge pixel's distance to that colour. Good on the
    plain backgrounds the prompt asks for; white parts touching a white background are lost."""
    im = Image.open(path).convert('RGB').resize((px, px), Image.LANCZOS)
    rgb = np.asarray(im)
    bg = white_bg(rgb)
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.int16)
    dist = np.abs(rgb.astype(np.int16) - np.median(edge, axis=0)).max(axis=2)
    # Enclosed holes (between rails, inside a ring) are background too when they are exactly its colour.
    hole = (dist < 7) & ~bg
    if hole.any():
        ids, counts, lab = labels(hole)
        bg = bg | np.isin(lab, ids[counts >= 24]) & hole
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    rim = dilate(bg) & ~bg
    alpha[rim] = np.clip(dist[rim] * 6, 0, 255).astype(np.uint8)
    return np.dstack([rgb, alpha])


CUT = os.environ.get('ART_CUT', 'birefnet')      # birefnet, or local (no model, no cost)


def finish_one(word, cand):
    cut = os.path.join(WORK, 'cut', word + '.png')
    if not os.path.exists(cut):
        os.makedirs(os.path.dirname(cut), exist_ok=True)
        raw = os.path.join(WORK, 'raw', word, cand + '.png')
        if CUT == 'local':
            cut = os.path.join(WORK, 'cut_local', word + '.png')
            os.makedirs(os.path.dirname(cut), exist_ok=True)
            Image.fromarray(local_cut(raw)).save(cut)
        else:
            Image.fromarray(birefnet(raw)).save(cut)
    arr = snap(np.asarray(Image.open(cut).convert('RGBA')))
    if arr is None: return word, None
    im = Image.fromarray(arr)
    buf = io.BytesIO(); im.save(buf, 'WEBP', lossless=True, quality=100, method=6)
    data = buf.getvalue()
    name = f"{word}.{hashlib.sha1(data).hexdigest()[:8]}.webp"
    return word, (name, data, im.width, im.height, arr)


def top_profile(arr, bands=5):
    """Heights (0 = top, 1 = bottom) of the subject's top edge in a few bands, for flames."""
    a = arr[:, :, 3] > 0
    h, w = a.shape
    out = []
    for i in range(bands):
        cols = a[:, int(w * i / bands):max(int(w * i / bands) + 1, int(w * (i + 1) / bands))]
        rows = np.nonzero(cols.any(1))[0]
        out.append(round(float(rows.min() / h), 2) if len(rows) else 1)
    return out


def cmd_finish():
    picks = tsv(os.path.join(WORK, 'picks.tsv'))           # word, cand (seed)
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.json')
    todo = [r for r in picks if r['cand']]
    new_cuts = 0 if CUT == 'local' else sum(1 for r in todo if not os.path.exists(os.path.join(WORK, 'cut', r['word'] + '.png')))
    if fal.spent() + new_cuts * BIREFNET_PRICE > 70: sys.exit('would exceed budget')
    manifest = {}
    with cf.ThreadPoolExecutor(8) as ex:
        for word, res in ex.map(lambda r: finish_one(r['word'], r['cand']), todo):
            if not res: print('empty after cut-out:', word); continue
            name, data, w, h, arr = res
            open(os.path.join(OUT, name), 'wb').write(data)
            manifest[word] = [name, w, h, top_profile(arr)]
    if new_cuts: fal.log_cost(BIREFNET, new_cuts, BIREFNET_PRICE, 'cut-out of picks')
    keep = {v[0] for v in manifest.values()}
    for f in os.listdir(OUT):
        if f.endswith('.webp') and f not in keep: os.remove(os.path.join(OUT, f))
    aliases = {r['word']: r['uses_art_of'] for r in tsv(os.path.join(HERE, 'aliases.tsv'))}
    doc = {'v': 1, 'px': OUT_PX, 'words': dict(sorted(manifest.items())),
           'alias': {a: b for a, b in sorted(aliases.items()) if b in manifest}}
    json.dump(doc, open(man_path, 'w'), separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(len(manifest), 'images,', round(total / 1e6, 2), 'MB')


if __name__ == '__main__':
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'prompts': cmd_prompts()
    elif cmd == 'generate': cmd_generate(set(args) or None, os.environ.get('ART_ROUND', '1'))
    elif cmd == 'qc': cmd_qc()
    elif cmd == 'sheets': cmd_sheets(int(args[0]) if args else 10, set(args[1:]) or None, os.environ.get('ART_TAG', 'judge'))
    elif cmd == 'finish': cmd_finish()
    else: sys.exit(__doc__)
