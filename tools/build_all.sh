#!/bin/sh
# usage: build_all.sh <wordnet dict dir>   (python with wordfreq on PATH)
set -e
cd "$(dirname "$0")"
python build_demo.py --overrides
python build_lexicon.py "$1" > /dev/null
python build_schema.py > /dev/null
python build_demo.py
python build_watchlist.py > /dev/null
