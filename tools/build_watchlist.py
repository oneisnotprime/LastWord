#!/usr/bin/env python3
"""Write ../data/watchlist.tsv: words whose meaning is strong for what they cost to spell.

cost = sum over letters of (share of E / share of that letter), from letters.json,
so E costs 1 and a letter ten times scarcer costs 10. Candidates are hand-picked by
meaning; the script keeps those in the lexicon or inert list and ranks by cost.
"""
import os, json
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

CANDIDATES = {
 "mass destruction": "nuke bomb atom sun star nova supernova quasar comet meteor asteroid volcano tsunami earthquake quake flood plague virus anthrax apocalypse armageddon doom hell void abyss antimatter sarin napalm mine lava magma ocean sea storm tornado hurricane famine war death pox rot blight tide inferno deluge cataclysm holocaust pandemic",
 "beings and forces": "god deity titan angel demon devil lich djinn genie dragon hydra kraken giant ogre reaper zombie ghost golem sphinx wizard mage king emperor tyrant army legion horde swarm mob navy fleet host leviathan behemoth colossus",
 "absolute and scaling modifiers": "all any every total pure max mega super ultra epic mighty vast huge big great best top prime dire fatal lethal deadly toxic atomic nuclear cosmic divine holy infinite eternal immortal immune invisible invincible safe sure free more most many ten hundred thousand million billion trillion myriad double triple twin dual omnipotent almighty supreme ultimate perfect",
 "verbs that end things": "kill slay end die win raze ruin undo ban own rob take steal erase delete destroy smite mute bind rule reign stop halt freeze annihilate obliterate banish reset eat gut axe zap",
 "verbs that escape or multiply": "fly hide heal cure grow wish copy clone revive resurrect summon teleport warp vanish multiply breed spawn double",
 "letter and word meta": "alphabet letter word dictionary lexicon vowel consonant font type press printer scribe pen ink book library abc text name noun verb spell rune glyph",
 "economy": "mint bank gold farm factory mirror loot tax rent loan debt oil ore crop herd",
 "rules, fate and information": "law veto truce peace victory time fate luck magic curse hex jinx charm miracle key map eye spy radar oracle seer omen",
 "death escape": "heir soul phoenix ark vault bunker heaven elixir will",
 "map-scale terrain and states": "moon earth world planet universe cosmos galaxy space sky pit ice fog night dark winter sand",
}

def main():
    share = {l["letter"].lower(): l["lexicon_share"] for l in json.load(open(os.path.join(D, "letters.json")))}
    cost = lambda w: round(sum(share["e"] / share[c] for c in w), 1)
    known = {}
    for name in ("inert.tsv", "lexicon.tsv"):
        for line in list(open(os.path.join(D, name)))[1:]:
            w, role, cls, arch = line.split("\t")[:4]
            known.setdefault(w, []).append(f"{role}:{arch}" if cls != "inert" else f"{role}:inert")
    rows, missing = [], []
    for reason, words in CANDIDATES.items():
        for w in words.split():
            if w not in known:
                missing.append(w); continue
            rare = "".join(sorted({c.upper() for c in w if share[c] < 0.012}))
            rows.append((w, reason, len(w), cost(w), round(cost(w) / len(w), 1), rare or "-", " ".join(known[w])))
    rows.sort(key=lambda r: (r[1], r[3]))
    with open(os.path.join(D, "watchlist.tsv"), "w") as f:
        f.write("word\treason\tlength\tcost\tcost_per_letter\tscarce_letters\troles\n")
        for r in rows:
            f.write("\t".join(map(str, r)) + "\n")
    print(len(rows), "missing:", missing)
    for r in sorted(rows, key=lambda r: r[3])[:45]:
        print(f"{r[0]:9}{r[3]:5} {r[1]}")
    print("costliest:", [(r[0], r[3]) for r in sorted(rows, key=lambda r: -r[3])[:8]])

if __name__ == "__main__":
    main()
