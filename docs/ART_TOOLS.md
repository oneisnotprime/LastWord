# Art tools for per-word standees

Research for the TODO item "Before the next art pass: research external tools". Goal: every word
(a few hundred thousand, `data/lexicon.tsv` + `data/proper.tsv`) gets its own Paper Diorama
standee, made ahead of time, cheap, in one consistent style. Prices were checked in November
2026 and move often; confirm on the linked pages before spending.

## What the game actually needs from a generator

The paper look (white cut border, drop shadow, stand, flames, badges) is already drawn by code
in `client/src/art/paper.ts` and `standee.ts`. A generator only has to supply a **flat-coloured
silhouette with a few interior details on a transparent background**, seen from the front at a
slight angle. That is much easier to keep consistent than finished illustrations:

- generate flat colour on a plain background, cut it out, posterise to `palette.ts`, and let the
  existing paper renderer add border and shadow, so every word gets the same "paper" for free;
- optionally trace the cut-out into polygons (vtracer) and store it as a `Silhouette`, which keeps
  files tiny and lets the existing code tint, scale and burn it like a hand-made shape.

Each word already has one sense (`synset` column) and a frequency (`zipf`, `tier`), so the prompt
can use that sense's WordNet gloss, and work can be ordered by frequency.

## Options compared

Per-image prices at roughly 512 to 1024 px. "Own look per word" is yes for all of them; the
question is cost, consistency and licence.

| Option | Price per image | Style consistency | Transparency | Licence for a commercial game | Notes |
|---|---|---|---|---|---|
| **Z-Image-Turbo (6B), self-hosted** | ~$0.0001 to $0.0002 (GPU time, see below) | Style LoRA (fal trainer $2.26 / 1,000 steps) | Plain background, then cut out | Apache 2.0 | ~2.3 s per 1024² image on an RTX 4090 at 8 steps; fits 16 GB |
| Z-Image-Turbo, hosted | $0.0006 to $0.005 (Runware, fal, Atlas) | Same LoRA on fal ($0.0085/MP with LoRA) | Cut out | Apache 2.0 weights; host ToS | No GPU ops |
| **FLUX.2 [klein] 4B** | BFL API ~$0.014; self-host similar to Z-Image | LoRA, multi-reference editing | Cut out | 4B Apache 2.0 (9B is non-commercial) | Good alternative base model |
| FLUX.1 [schnell] | ~$0.0013 to $0.003 hosted | LoRA | Cut out | Apache 2.0 | Older; [dev] is non-commercial (and is the only FLUX with LayerDiffuse alpha) |
| SDXL + LayerDiffuse | Self-host, ~1 s per image | Huge LoRA ecosystem | **Native alpha** (LayerDiffuse LoRA) | CreativeML OpenRAIL++ (commercial OK) | Weaker prompt following than newer models |
| Qwen-Image (20B) | Self-host, slower | LoRA | Cut out | Apache 2.0 | Best text/prompt following of the open models; heavier |
| Recraft V4 Styles | $0.035 raster, **$0.05 vector**; V4.1 Flash $0.007 raster | Custom style from reference images ($0.005 per style) | Remove background $0.01 | Commercial use on paid API | Only hosted model that outputs real SVG in a custom style |
| Gemini 3.1 Flash Image ("Nano Banana 2") | $0.045 at 512 px; batch ~50% off | Reference images in the prompt; strong edit consistency | Cut out | Outputs owned by user; invisible SynthID watermark | 2.5 Flash Image ($0.0195 batch) retires 2027-03 |
| OpenAI GPT Image (mini / 1.5) | mini ~$0.005 low to ~$0.04 high; batch 50% off | Reference image edits | Native `background: transparent` | Outputs owned by user | gpt-image-1-mini is being retired; check the successor |
| PixelLab (pixel art) | ~$0.007 to $0.013 (provisional, scales with size) | Style reference, rotations | Yes | Check ToS | Pixel art only; no longer the game's style (PLAN.md still says pixel) |
| **LLM writes the `Silhouette` DSL** (today's method, batched) | Haiku 5.5 batch ~$0.0005; Sonnet 5.5 batch ~$0.01 per word (~1.5k output tokens) | Perfect (same renderer) | n/a (vector) | No licence issue | Recognisability falls off fast for complex objects; good for abstract words |
| Open text-to-SVG (OmniSVG 4B, StarVector) | Self-host | Icon-dataset style, not ours | n/a | Check each model card | Research quality; not ready for 300k consistent assets |
| Procedural only / asset packs | ~0 | Perfect | n/a | Pack licence | Cannot give 300k words their own look; keep as the fallback layer |

### Self-hosting vs API for 300,000 words

Assume 4 candidates per word (1.2 M images) at 768 px, which is about 1.3 s each on a 4090
(Z-Image-Turbo is ~2.3 s at 1024²). A 4090 rents for ~$0.34 to $0.50/h (RunPod community,
Vast.ai); an H100 ~$1.80 to $3.50/h.

| Route | Images | Compute | Cost |
|---|---|---|---|
| Self-hosted Z-Image-Turbo, 4090 | 1.2 M | ~430 GPU-hours (~2.3 days on 8 GPUs) | **~$150 to $220** |
| Hosted Z-Image-Turbo / FLUX schnell | 1.2 M | none | ~$700 (Runware low) to ~$6,000 (fal/Atlas at $0.005) |
| Recraft V4 Styles vector, 1 per word | 300 k | none | ~$15,000 (+ retries) |
| Gemini 3.1 Flash Image batch, 1 per word | 300 k | none | ~$7,000 |
| PixelLab, 1 per word | 300 k | none | ~$2,400 to $3,900 |

Self-hosting an Apache-licensed model wins by one to two orders of magnitude at this scale, and
the LoRA, seeds and model version stay frozen, so words added later match words made now.

## Recommended pipeline

1. **Prompt**: one line per word from `word + role + class + archetype + WordNet gloss of its
   synset`, written by Claude Haiku 5.5 through the Message Batches API (~150 output tokens, about
   $15 for 300k). Describe one concrete object or figure that shows the sense (abstract words get a
   symbol: "luck" → a four-leaf clover). Ambiguous words are already resolved by the `synset`
   column; the image follows the game's sense, never the other ones.
2. **Generate**: Z-Image-Turbo (fallback FLUX.2 klein 4B) + a style LoRA for "flat paper cut-out,
   limited palette, front three-quarter view, centred, plain white background", 4 seeds per word,
   768 px, ComfyUI or diffusers on rented 4090s. Train the LoRA on 30 to 60 images: renders of the
   current hand-made standees from `client/gallery.html` plus the best pilot outputs.
3. **Cut out**: BiRefNet (MIT) to alpha; flat backgrounds make this reliable (<1 s per image).
   Avoid RMBG-2.0 (non-commercial weights).
4. **Normalise**: crop to the alpha box, scale to a fixed height by `size` class, quantise to the
   `palette.ts` colours (k-means then snap), drop specks.
5. **QC (automatic)**: reject on alpha checks (single main component, fill ratio, nothing touching
   the edge, no white halo); score the rest with SigLIP 2 against "a paper cut-out of <gloss>" and
   against a "text, letters, frame, photo" negative list; send the top 2 to a vision model (Haiku
   5.5, batch) for a yes/no "is this recognisably <word> in this sense?". Keep the best; words with
   no pass go to a regeneration queue with a rewritten prompt, then to the archetype fallback.
6. **Output**: two variants, decide in the pilot:
   - **raster**: 128 px tall RGBA WebP/PNG-8, ~3 to 6 KB each (~1.5 GB for 300k);
   - **vector**: vtracer in polygon mode → simplify → `Silhouette` JSON (~1 KB gzipped,
     ~0.3 GB for 300k), drawn by the existing paper renderer.
7. **Delivery**: object storage + CDN (e.g. Cloudflare R2, no egress fees), one file per word at a
   hashed path, fetched when the word is first spelled in a match (a match uses tens to a few
   hundred words). Pack the ~5,000 most frequent words (by `zipf`) into a few atlases that ship
   with the client. Fallback while loading or when missing: today's archetype shape.
8. **Human review**: a contact-sheet page (like `gallery.html`) to approve or reject in grids of
   100. Full review is feasible for the common tiers; obscure words rely on QC plus spot checks.

### Estimates

| | Pilot: 3,000 words | Full: 300,000 words |
|---|---|---|
| Prompts (Haiku 5.5 batch) | <$1 | ~$15 |
| Style LoRA training | ~$5 (2 runs) | reuse |
| Generation, 4 per word, own 4090s | 12 k images, ~4.5 GPU-h, ~$2 | 1.2 M images, ~430 GPU-h, ~$150 to $220 |
| Cut-out + SigLIP scoring | ~$1 | ~$30 to $50 |
| Vision-model check (Haiku 5.5 batch, 2 images) | ~$1 | ~$50 to $100 |
| Regeneration of failures (~20%) | ~$1 | ~$50 |
| Storage + CDN | negligible | a few $/month |
| **Total compute** | **~$10 to $20** | **~$300 to $450** (hosted API instead: ~$1,000 to $6,500) |
| Wall time | ~1 day incl. setup; ~2 h review | ~3 days on 8 GPUs; review only common tiers |

The real cost is setup and review time, not money.

## 50-word pilot

Pick 50 words that stress the style: 10 weapons and tools, 10 creatures, 8 people and roles,
6 vehicles and buildings, 6 materials and terrain-like nouns, 6 abstract nouns (truth, chaos,
luck, fate, nothing, time), 4 multi-sense words (bat, bank, crane, spring) checked against the
`synset` in `lexicon.tsv`.

1. Write prompts with the template above; keep them in a TSV next to the outputs.
2. Run the same 50 through four routes: Z-Image-Turbo with no LoRA (prompt only), Z-Image-Turbo
   with a quick LoRA trained on gallery renders, Recraft V4 Styles vector with a style made from
   the same renders, and Haiku 5.5 writing the `Silhouette` DSL (the cheap vector baseline).
   About $5 total.
3. Run cut-out, palette snap, vtracer, and render all of them through `standee.ts` in a gallery
   page next to the current hand-made shapes, at in-game size.
4. Score each route on: recognisable at game size (blind guess of the word), matches the paper
   look next to hand-made shapes, sense correct, clean silhouette, cost per accepted word.
5. Decide raster vs vector output and the route, then run the 3,000 most frequent nouns.

## Risks

- **Consistency drift**: prompt-only generation drifts; a LoRA plus palette snap plus the shared
  paper renderer is what holds the look. Freeze model, LoRA, sampler and seeds per release.
- **Recognisability at small size**: obscure or abstract words make vague pictures. Judge at
  in-game size; allow a symbol-style prompt for abstract words; keep the archetype fallback.
- **Wrong sense or unwanted content**: proper nouns (real people, brands) should not get
  likenesses or logos; give them archetype art or symbols. Filter for text and logos in QC.
- **Licences**: use only Apache/MIT/OpenRAIL weights (Z-Image, FLUX.2 klein 4B, FLUX schnell,
  SDXL, BiRefNet). FLUX dev, klein 9B and RMBG-2.0 are non-commercial.
- **Copyright of outputs**: purely generated images may not be protectable by copyright (US), so
  others could reuse them. Human selection and the code-drawn paper layer help but do not settle it.
- **Price and model churn**: hosted models are retired within a year (gpt-image-1-mini, Gemini
  2.5 Flash Image). Self-hosted weights do not change, which also keeps later batches matching.
- **Review load**: 300k cannot all be reviewed by hand; rely on QC and review by frequency tier.

## Sources

- Z-Image-Turbo speed and licence: [runaihome.com](https://runaihome.com/blog/z-image-turbo-16gb-vram-home-lab-image-gen-2026/), [tech-insider.org](https://tech-insider.org/z-image-turbo-local-setup-2026), [vast.ai model page](https://vast.ai/model/z-image-turbo)
- Z-Image hosted prices: [fal.ai](https://fal.ai/models/fal-ai/z-image/turbo), [Runware alternatives](https://runware.ai/alternative), [Runware vs WaveSpeed](https://runware.ai/wavespeed-alternative), [Runware pricing docs](https://runware.ai/docs/models-api/pricing.md), [Atlas Cloud](https://atlascloud.ai/models/z-image/turbo)
- LoRA training prices: [fal Z-Image trainer](https://fal.ai/models/fal-ai/z-image-trainer), [fal: fine-tune FLUX via API](https://fal.ai/learn/devs/how-to-fine-tune-flux-with-the-api)
- FLUX.2 klein licence and price: [BFL help](https://help.bfl.ai/articles/8642316687-flux-2-klein-fast-generation-guide), [BFL blog](https://bfl.ai/blog/flux2-klein-towards-interactive-visual-intelligence)
- FLUX schnell prices: [pricepertoken](https://pricepertoken.com/flux-pricing), [EachLabs](https://www.eachlabs.ai/ai-models/flux-schnell/pricing)
- Recraft prices: [Recraft API pricing](https://www.recraft.ai/docs/api-reference/pricing.md)
- Gemini image prices: [Google Vertex model page](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image), [benchlm snapshot](https://benchlm.ai/media-pricing/nano-banana), [2.5 batch rate](https://techearl.com/nano-banana-batch-api)
- OpenAI image batch: [Batch API guide](https://developers.openai.com/api/docs/guides/batch), [gpt-image-1-mini](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- PixelLab: [PixelLab API](https://www.pixellab.ai/pixellab-api), [community price benchmark](https://github.com/Shilo/pixellab-pip/blob/main/docs/pixellab-image-model-benchmark-results.md)
- GPU rental: [RunPod pricing](https://www.runpod.io/gpu-cloud/pricing), [Spheron RunPod vs Vast 2026](https://www.spheron.network/blog/gpu-cloud-pricing-comparison-runpod-vs-vastai-2026/)
- Transparency: [LayerDiffuse paper](https://huggingface.co/papers/2402.17113), [Runware LayerDiffuse](https://runware.ai/blog/introducing-layerdiffuse-generate-images-with-built-in-transparency-in-one-step), [BiRefNet](https://vast.ai/model/birefnet), [RMBG-2.0 licence](https://huggingface.co/briaai/rmbg-2.0)
- Vector: [vtracer](https://github.com/visioncortex/vtracer), [OmniSVG](https://huggingface.co/OmniSVG/OmniSVG1.1_4B), [StarVector](https://www.sourcepulse.org/projects/1941692)
- Qwen-Image licence: [VentureBeat](https://venturebeat.com/ai/qwen-image-is-a-powerful-open-source-new-ai-image-generator-with-support-for-embedded-text-in-english-chinese)
- Claude prices (Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10 per MTok, Batches 50% off): Anthropic API pricing
