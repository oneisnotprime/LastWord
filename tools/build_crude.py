#!/usr/bin/env python3
"""Write ../data/crude.json: the words of tools/crude.txt that the dictionary (../data/demo.json)
knows, sorted. Tips, words of the moment and bots skip them (shared Dictionary `crude`)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "..", "data")


def main():
    words = json.load(open(os.path.join(D, "demo.json")))
    listed = [l.strip().lower() for l in open(os.path.join(HERE, "crude.txt")) if l.strip() and not l.startswith("#")]
    known = sorted({w for w in listed if w in words})
    with open(os.path.join(D, "crude.json"), "w") as f:
        json.dump(known, f, indent=0)
        f.write("\n")
    print(f"crude: {len(known)} of {len(listed)} listed words are in the dictionary")


if __name__ == "__main__":
    main()
