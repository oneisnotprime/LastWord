"""Tiny fal.ai client. Credentials come from the environment (FAL_KEY) or a proxy that injects them.

Every paid call is logged with its estimated cost to costs.md in the work folder (ART_WORK)."""
import json, os, time, requests
ART = os.environ.get('ART_WORK') or os.getcwd()
COSTS = os.path.join(ART, 'costs.md')
S = requests.Session()
if os.environ.get('FAL_KEY') and os.environ['FAL_KEY'] != 'proxy-injected':
    S.headers['Authorization'] = 'Key ' + os.environ['FAL_KEY']

def log_cost(what, n, unit, note=''):
    new = not os.path.exists(COSTS)
    with open(COSTS, 'a') as f:
        if new: f.write('| time | call | n | est. $ | note |\n|---|---|---|---|---|\n')
        f.write(f'| {time.strftime("%H:%M:%S")} | {what} | {n} | {n*unit:.4f} | {note} |\n')

def spent():
    if not os.path.exists(COSTS): return 0.0
    t = 0.0
    for line in open(COSTS):
        p = [x.strip() for x in line.split('|')]
        if len(p) > 5:
            try: t += float(p[4])
            except ValueError: pass
    return t

def upload(path, ctype):
    r = S.post('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', json={'content_type': ctype, 'file_name': os.path.basename(path)}, timeout=60)
    r.raise_for_status(); j = r.json()
    with open(path, 'rb') as f:
        u = S.put(j['upload_url'], data=f, headers={'Content-Type': ctype}, timeout=600)
    u.raise_for_status()
    return j['file_url']

def run(endpoint, args, timeout=300, tries=3):
    for i in range(tries):
        try:
            r = S.post(f'https://fal.run/{endpoint}', json=args, timeout=timeout)
            if r.status_code >= 500 or r.status_code == 429: raise RuntimeError(f'{r.status_code} {r.text[:200]}')
            if r.status_code != 200: return {'error': r.status_code, 'body': r.text[:500]}
            return r.json()
        except Exception as e:
            if i == tries - 1: return {'error': 'exc', 'body': str(e)[:500]}
            time.sleep(3 * (i + 1))

def submit(endpoint, args):
    r = S.post(f'https://queue.fal.run/{endpoint}', json=args, timeout=60); r.raise_for_status(); return r.json()

def wait(sub, every=15):
    while True:
        s = S.get(sub['status_url'], timeout=60).json()
        if s.get('status') == 'COMPLETED': break
        print('status', s.get('status'), s.get('queue_position'), flush=True); time.sleep(every)
    return S.get(sub['response_url'], timeout=60).json()

def fetch(url, path):
    r = S.get(url, timeout=120); r.raise_for_status()
    with open(path, 'wb') as f: f.write(r.content)
