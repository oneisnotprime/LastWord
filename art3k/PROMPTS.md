# Writing image subjects for Last Word words (batch n)

Last Word is a word game: each word becomes a thing in the game with the properties in
`facts` (from data/demo.json). Each word gets a small paper cut-out picture made by an image
model. You write the SUBJECT the picture shows. Read `art3k/batch_<n>.tsv`
(columns: word, zipf, class, archetype, facts, gloss, gloss_class_matches, other_senses).

## Rules

1. Show the GAME meaning. `class`, `archetype` and `facts` decide what the word is; the WordNet
   `gloss` is only a hint and is often the wrong sense (gloss_class_matches=no means it surely is;
   other_senses lists alternatives). Where they disagree, the game data wins. Examples:
   KEY (artifact/tool, counters=lockable) = "a brass door key"; BANK (artifact/building,
   storage_letters, trade_bonus) = "a stone bank building with columns and a heavy vault door";
   CAN (container, material=tin) = "a tin can"; FRANK (consumable/food) = "a frankfurter sausage
   in a bun"; BRAZIL (flora/produce) = "a brazil nut"; DAY (celestial, sets daylight) = "a bright
   yellow sun".
2. ONE concrete object, creature or figure, whole and alone, that a player would recognise at
   about 50 pixels tall. No scenes, no backgrounds, no text, letters, numbers, logos or signs
   with writing, no frames. Prefer a shape with a distinctive silhouette.
3. People (class person): one standing person whose costume and one held prop show the role
   ("a judge in a black robe holding a gavel"). Never a real or famous person's likeness.
4. Creatures: the animal itself, whole, side view. Supernatural: the classic folk look.
5. Materials: a typical lump, pile, ingot, sack, jar, barrel or crystal of it. Liquids and gases:
   a glass bottle or flask holding it. Food and drink: the dish or drink itself (drinks in a
   suitable glass, cup or bottle).
6. Body parts: the part alone, clean, cartoon-like, not gory (a heart as a cartoon anatomical
   heart, a hand as an open hand).
7. Words that sound abstract but are things in the game (a document, a website, a video, a fund)
   get the object that holds them: a paper document, a laptop showing a web page, a film reel,
   a money sack. Keep it physical.
8. Rude words: show their game meaning plainly and inoffensively (BITCH = a female dog;
   SHIT = a cartoon brown dung pile). Nothing sexual or gory.
9. Keep each subject under 16 words, starting with "a", "an" or "some".

## Output

Write `art3k/subjects_<n>.tsv` with a header line `word<TAB>subject<TAB>colours` and one row
per input word, in the same order, every word present. `colours` is 2 to 4 plain colour words
for its main parts ("brass yellow, dark brown"); use the facts' color/material when given.
Write it yourself, word by word (no scripts that template it). Commit only that file and push
to a new branch `art3k-prompt-<n>` made from this branch. Then reply "done" and stop.
