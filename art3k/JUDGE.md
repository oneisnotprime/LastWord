# Judging generated word art (judge n)

Last Word is a word game; each word becomes a thing on the map, drawn as a small paper cut-out
standee about 40 to 60 pixels tall. An image model made 4 candidates (A to D) per word. Pick the
best one, or reject the word.

Your sheets are `art3k/sheets/sheet_<k>.jpg` for k in the range given in your task. Each row is
one word: on the left the WORD, its game class/archetype and the subject the prompt asked for
(the subject was written from the GAME meaning: trust it over other senses of the word). Then
candidates A to D, each with a small copy at about game size in its corner, and the automatic
check under it ("ok", or "X" and why: X candidates failed a hard check, such as touching the edge
or being a framed scene; pick one only if every other is worse).

Pick the candidate that best does all of:

1. Shows the GAME meaning (the subject line), recognisable at the small size, without a label.
2. One whole subject on plain white: no scene, no frame or card behind it, no ground strip,
   not cropped, no extra objects or creatures, no text, letters or numbers.
3. Flat paper cut-out look (a few flat colours). Mild shading is fine.
4. No faces on objects, nothing gory, sexual or offensive.

Reject (X) when no candidate passes 1 and 2. For a reject, write a better subject for a retry:
one concrete object, under 16 words, aimed at what went wrong (e.g. the model drew a scene,
the wrong sense, text, or an unclear shape). Say "same" if the subject was fine and only the
pictures failed.

## Output

Write `art3k/judge_<n>.tsv` with header `word<TAB>pick<TAB>note<TAB>retry_subject<TAB>retry_colours`
and one row per word on your sheets: pick is A, B, C, D or X; note is a few words (why X, or a
worry); retry_subject and retry_colours only for X (else empty). Look at every sheet yourself
(Read the image); do not guess from the subject. Commit only that file, push to a new branch
`art3k-judge-<n>` made from this branch, reply "done" and stop.
