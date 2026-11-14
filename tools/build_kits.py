#!/usr/bin/env python3
"""Write ../data/kits.json: the jobs, starting buildings and legendary words of starting kits
(PLAN.md "Starting kits") from tools/kits.txt and ../data/demo.json.

- Jobs: the core in kits.txt first (a word not in the dictionary yet is skipped), then the rest of
  JOBS from the dictionary's profession words (person nouns: workers, leaders, fighters,
  criminals), their perks derived by rule from the word's own properties.
- Buildings: the buildings in kits.txt that are in the dictionary, then other fixed things that
  act on a shared system (letters, claims, fields, light, healing, supplies), most common first.
- Legendaries: kits.txt, checked: in the dictionary, a known unlock condition, and a counter word
  whose `counters` names it.
Fails if there are fewer than JOBS jobs or BUILDINGS buildings.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "..", "data")
JOBS, BUILDINGS = 100, 100
# Properties a job holds as its own (a carried tool's), not changes to its holder's body.
OWN = {"harvest_sources", "harvest_bonus", "trade_rate", "command_limit", "authority", "recruit_rate"}
UNLOCKS = {"minutes": True, "letters": False, "land": True, "boss": False, "producers": True,
           "regions": True, "hunts": True, "trades": True, "city": False, "kills": True}
PEOPLE = {"worker", "leader", "fighter", "criminal"}
# What each gathering source leans a starting hand toward.
SOURCE_LETTERS = {"fishing": "o", "river": "o", "field": "a", "plant": "p", "crop": "a", "orchard": "p",
                  "hunting": "h", "dig": "g", "mine": "g", "quarry": "g", "tree": "e", "forage": "e"}


def tokens(toks, props, where, errors):
    own, ops, letters = {}, [], ""
    for t in toks:
        if t.startswith("letters="):
            letters = t[8:]
            continue
        m = re.fullmatch(r"(\w+)([=*+])(.+)", t)
        if not m or m.group(1) not in props:
            errors.append(f"{where}: bad token {t}"); continue
        pid, op, val = m.groups()
        p = props[pid]
        if op == "=":
            if pid not in OWN:
                errors.append(f"{where}: {pid} is not a job's own property ({', '.join(sorted(OWN))})"); continue
            own[pid] = val.split(",") if p["type"] == "tags" else float(val)
        else:
            if p["type"] not in ("num", "scale", "frac"):
                errors.append(f"{where}: {t}: needs a numeric property"); continue
            ops.append([pid, "mul" if op == "*" else "add", float(val)])
    return own, ops, letters


def derive(word, v):
    """A job's perks from a profession word's own properties, by rule."""
    s, arch = v["set"], v["archetype"]
    own, ops, letters = {}, [], ""
    num = lambda k: float(s.get(k, 0) or 0) if not isinstance(s.get(k), (list, str, bool)) else 0
    sources = s.get("harvest_sources") or []
    if sources and num("harvest_bonus") > 1:
        own["harvest_sources"] = sources
        own["harvest_bonus"] = min(3.0, num("harvest_bonus") + 1)
        letters += "".join(SOURCE_LETTERS.get(x, "") for x in sources)
    made = [k[-1] for k in s if k.startswith("produce_") and num(k) > 0 and k[-1] not in "NY"]
    for ch in made:
        ops.append([f"produce_{ch}", "mul", 1.25]); letters += ch.lower()
    if num("craft_slots") > 0 and "C" not in made:
        ops.append(["produce_C", "mul", 1.25]); letters += "c"
    if num("trade_bonus") > 0:
        own["trade_rate"] = round(max(0.6, 1 - num("trade_bonus")), 2)
        ops.append(["produce_T", "mul", 1.5]); letters += "t"
    if num("command_limit") > 0:
        own["command_limit"] = min(8.0, max(2.0, round(num("command_limit") / 2)))
    if num("authority") >= 5:
        own["authority"] = min(5.0, round(num("authority") / 2))
        letters += "s"
    if num("recruit_rate") > 0:
        own["recruit_rate"] = min(0.5, num("recruit_rate"))
    if num("heals") > 0:
        ops.append(["integrity", "mul", 1.15]); ops.append(["res_poison", "add", 0.3])
    if num("map_reveal") > 0 or num("sight_range") > 60:
        ops.append(["sight_range", "mul", 1.3]); letters += "j"
    if num("speed_land") > 5:
        ops.append(["speed_land", "mul", 1.1])
    if num("strength") > 5:
        ops.append(["strength", "add", 2])
    if num("stealth") > 0:
        ops.append(["stealth", "add", min(4.0, num("stealth"))]); letters += "d"
    if num("build_speed") > 1:
        ops.append(["produce_B", "mul", 1.25]); letters += "b"
    if num("intelligence") >= 8:
        ops.append(["produce_Y", "mul", 1.5]); letters += "y"
    if num("detect_stealth") >= 3:
        ops.append(["sight_range", "mul", 1.15])
    damage = sum(num(k) for k in s if k.startswith("dmg_"))
    if damage >= 20 or arch == "fighter":
        ops.append(["armor", "add", 6]); ops.append(["integrity", "mul", 1.15]); letters += "k"
    for k in s:
        if k.startswith("res_") and num(k) > 0:
            ops.append([k, "add", round(min(0.5, num(k)), 2)])
    if not own and not ops:
        if arch == "worker" and num("labor") > 0:
            ops.append(["produce_N", "mul", 1.3]); letters += "n"
        elif arch == "leader":
            own["command_limit"] = 4.0; letters += "s"
        elif arch == "criminal":
            ops.append(["stealth", "add", 2]); letters += "d"
    # One change per property: the first rule to touch it wins.
    seen, kept = set(), []
    for o in ops:
        if o[0] not in seen:
            seen.add(o[0]); kept.append(o)
    letters = "".join(dict.fromkeys(ch for ch in letters if ch.isalpha())) or word[0]
    return own, kept, letters[:3]


def systems(v):
    """The shared systems a fixed thing acts on, or [] if none."""
    s = v["set"]
    out = [k for k in ("claim_radius", "field_radius", "luminosity", "heals", "food_output", "water_output",
                       "power_output", "fuel_output", "fear_aura", "command_limit", "recruit_rate") if s.get(k)]
    return out + [k for k in s if k.startswith("produce_") and s[k]]


def fixed(v):
    s = v["set"]
    return (v["role"] == "noun" and v["class"] == "artifact" and s.get("portable") is False and
            s.get("equip_slot", "none") == "none" and not s.get("mountable") and not s.get("self_propelled") and
            v["archetype"] != "route" and s.get("tile_type") in (None, "tilled"))


def main():
    props = {p["id"]: p for p in json.load(open(os.path.join(D, "properties.json")))["properties"]}
    words = json.load(open(os.path.join(D, "demo.json")))
    zipf = {}
    for line in list(open(os.path.join(D, "lexicon.tsv")))[1:]:
        f = line.split("\t")
        try: zipf[f[0]] = float(f[4])
        except (IndexError, ValueError): pass
    errors, missing = [], []
    jobs, buildings, legends, skip = {}, [], [], set()
    for n, line in enumerate(open(os.path.join(HERE, "kits.txt")), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        kind, _, rest = line.partition(" ")
        head, _, body = rest.partition(":")
        word, where = head.strip(), f"kits.txt:{n} {head.strip()}"
        if kind == "skip":
            skip.add(word)
        elif kind == "job":
            own, ops, letters = tokens(body.split(), props, where, errors)
            if word not in words:
                missing.append(word); continue
            if words[word]["class"] != "person":
                errors.append(f"{where}: not a person"); continue
            jobs[word] = {"word": word, "set": own, "ops": ops, "letters": letters or word[0], "core": True}
        elif kind == "building":
            if word not in words:
                missing.append(word); continue
            if not fixed(words[word]):
                errors.append(f"{where}: not a fixed thing on the ground"); continue
            if word not in buildings:
                buildings.append(word)
        elif kind == "legend":
            opts = dict(t.split("=", 1) for t in body.split() if "=" in t)
            unlock, counter = opts.get("unlock", ""), opts.get("counter", "")
            what, _, amount = unlock.partition(":")
            if word not in words:
                errors.append(f"{where}: not in the dictionary"); continue
            if what not in UNLOCKS or UNLOCKS[what] != bool(amount) or (amount and not amount.isdigit()):
                errors.append(f"{where}: bad unlock {unlock}"); continue
            if counter not in words or word not in (words[counter]["set"].get("counters") or []):
                errors.append(f"{where}: {counter} does not counter it"); continue
            legends.append({"word": word, "unlock": {"kind": what, **({"need": int(amount)} if amount else {})}, "counter": counter})
        else:
            errors.append(f"{where}: unknown line")
    # The rest of the jobs: profession words, perks by rule, those with the most to them and the
    # most common first.
    derived = []
    for w, v in words.items():
        if w in jobs or w in skip or v["role"] != "noun" or v["class"] != "person" or v["archetype"] not in PEOPLE:
            continue
        if not re.fullmatch(r"[a-z]{3,}", w) or (w.endswith("s") and w[:-1] in words):
            continue
        own, ops, letters = derive(w, v)
        if own or ops:
            derived.append((-(len(own) + len(ops)), -zipf.get(w, 0), w, own, ops, letters))
    for _, _, w, own, ops, letters in sorted(derived)[: max(0, JOBS - len(jobs))]:
        jobs[w] = {"word": w, "set": own, "ops": ops, "letters": letters, "core": False}
    others = sorted((-zipf.get(w, 0), w) for w, v in words.items()
                    if fixed(v) and systems(v) and w not in skip and w not in buildings)
    buildings += [w for _, w in others][: max(0, BUILDINGS - len(buildings))]
    if len(jobs) < JOBS: errors.append(f"only {len(jobs)} jobs")
    if len(buildings) < BUILDINGS: errors.append(f"only {len(buildings)} buildings")
    if errors:
        print("\n".join(errors)); sys.exit(1)
    out = {"jobs": list(jobs.values())[:JOBS], "buildings": buildings[:BUILDINGS], "legendaries": legends}
    with open(os.path.join(D, "kits.json"), "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    core = sum(1 for j in out["jobs"] if j["core"])
    print(f"kits: {len(out['jobs'])} jobs ({core} hand-tuned), {len(out['buildings'])} buildings, {len(legends)} legendaries"
          + (f"; not in the dictionary yet: {' '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
