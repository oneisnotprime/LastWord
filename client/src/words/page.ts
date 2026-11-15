/**
 * words.html: every playable word, searchable and filterable, with a detail panel that shows the
 * game's own card, every property with its meaning, its changes, counters, WordNet meaning and art.
 * The data side is model.ts; this file is the DOM: a virtual list (only rows in view exist) and
 * the panel. The whole state lives in the query string (model `toSearch`), so any view can be shared.
 */
import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import type { Card, PropertyDef } from "@lastword/shared";
import { dictionary as dict } from "../data.js";
import { lookOf } from "../art/look.js";
import { tag } from "../art/paper.js";
import { preload, rasterOf } from "../art/raster.js";
import { renderStandee } from "../art/standee.js";
import { buildIndex, cardFor, countersFor, DIMENSIONS, EMPTY, fromSearch, kindOf, numericProps, opRows, propertyRows, search, showValue, summaryOf, tally, toSearch,
  type Cmp, type Entry, type Lex, type Mode, type Query, type Summary } from "./model.js";

const t0 = performance.now();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (n: number) => n.toLocaleString("en-US");

const index = buildIndex(dict);
const byWord = new Map(index.map((e) => [e.w, e]));
const props = [...dict.properties.values()];
let lex: Lex | null = null;
let q: Query = fromSearch(location.search);
let rows: Entry[] = [];
const summaries = new Map<string, Summary>();
const summary = (w: string) => summaries.get(w) ?? summaries.set(w, summaryOf(dict, w)).get(w)!;

// ---- Filters ----------------------------------------------------------------------------------

const search$ = $<HTMLInputElement>("search"), mode$ = $<HTMLSelectElement>("mode"), gloss$ = $<HTMLInputElement>("gloss");
const role$ = $<HTMLSelectElement>("role"), cls$ = $<HTMLSelectElement>("cls"), arch$ = $<HTMLSelectElement>("arch"), group$ = $<HTMLSelectElement>("group"), dim$ = $<HTMLSelectElement>("dim");
const propIn = $<HTMLInputElement>("propIn"), propList = $("propList"), cmp$ = $<HTMLSelectElement>("cmp"), val$ = $<HTMLInputElement>("val");
const sort$ = $<HTMLSelectElement>("sort"), dir$ = $<HTMLButtonElement>("dir");

function options(sel: HTMLSelectElement, all: string, items: [string, string][]) {
  sel.innerHTML = `<option value="">${all}</option>` + items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join("");
}
const counted = (list: [string, number][]): [string, string][] => list.map(([k, n]) => [k, `${k.replaceAll("_", " ")} (${fmt(n)})`]);
options(role$, "any", counted(tally(index, (e) => e.def.role)));
options(cls$, "any", counted(tally(index, (e) => e.def.class)));
const groupCounts = new Map<string, number>();
for (const e of index) for (const g of e.groups) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
options(group$, "any", [...new Set(props.map((p) => p.group))].map((g) => [g, `${g} (${fmt(groupCounts.get(g) ?? 0)})`]));
options(dim$, "any", Object.entries(DIMENSIONS).map(([d, ids]) => [d, `${d} (${fmt(index.filter((e) => ids.some((id) => e.props.has(id))).length)})`]));
for (const o of dim$.querySelectorAll("option")) if (o.value) o.title = DIMENSIONS[o.value]!.join(", ");
const numeric = numericProps(dict, index);
sort$.innerHTML = `<option value="word">word</option><option value="length">length</option><option value="freq">frequency</option>` +
  [...new Set(numeric.map((p) => p.group))].map((g) => `<optgroup label="${g}">${numeric.filter((p) => p.group === g).map((p) => `<option value="${p.id}" title="${esc(p.desc)}">${p.id.replaceAll("_", " ")}</option>`).join("")}</optgroup>`).join("");

/** Archetypes for the chosen class (all when none). */
function archOptions() {
  const pool = q.cls ? index.filter((e) => e.def.class === q.cls) : index;
  options(arch$, "any", counted(tally(pool, (e) => e.def.archetype)));
  if (q.arch && !pool.some((e) => e.def.archetype === q.arch)) q.arch = "";
}

/** Puts the query into the controls. */
function toControls() {
  search$.value = q.q; mode$.value = q.mode; gloss$.checked = q.gloss;
  role$.value = q.role; cls$.value = q.cls; archOptions(); arch$.value = q.arch; group$.value = q.group; dim$.value = q.dim;
  propIn.value = q.prop; cmp$.value = q.cmp; val$.value = q.val; val$.disabled = q.cmp === "has";
  sort$.value = q.sort; dir$.textContent = q.desc ? "↓" : "↑";
  for (const el of [role$, cls$, arch$, group$, dim$, propIn, mode$]) el.classList.toggle("on", !!(el as HTMLInputElement).value && (el as HTMLInputElement).value !== "contains");
  for (const s of document.querySelectorAll<HTMLElement>("#head [data-sort]")) s.classList.toggle("sorted", s.dataset.sort === q.sort);
}

let timer = 0;
function update(patch: Partial<Query>, now = false) {
  q = { ...q, ...patch };
  if ("cls" in patch) archOptions();
  toControls();
  clearTimeout(timer);
  const run = () => { refilter(); history.replaceState(null, "", location.pathname + toSearch(q)); };
  if (now) run(); else timer = window.setTimeout(run, 60);
}

search$.addEventListener("input", () => update({ q: search$.value }));
mode$.addEventListener("change", () => update({ mode: mode$.value as Mode }, true));
gloss$.addEventListener("change", () => update({ gloss: gloss$.checked }, true));
role$.addEventListener("change", () => update({ role: role$.value }, true));
cls$.addEventListener("change", () => update({ cls: cls$.value, arch: "" }, true));
arch$.addEventListener("change", () => update({ arch: arch$.value }, true));
group$.addEventListener("change", () => update({ group: group$.value }, true));
dim$.addEventListener("change", () => update({ dim: dim$.value }, true));
cmp$.addEventListener("change", () => update({ cmp: cmp$.value as Cmp }, true));
val$.addEventListener("input", () => update({ val: val$.value }));
sort$.addEventListener("change", () => update({ sort: sort$.value, desc: !["word", "length"].includes(sort$.value) }, true));
dir$.addEventListener("click", () => update({ desc: !q.desc }, true));
$("reset").addEventListener("click", () => update({ ...EMPTY, w: q.w }, true));
for (const s of document.querySelectorAll<HTMLElement>("#head [data-sort]")) s.addEventListener("click", () => update(q.sort === s.dataset.sort ? { desc: !q.desc } : { sort: s.dataset.sort!, desc: false }, true));

// The property picker: type to narrow, each property with its group and meaning.
let picks: PropertyDef[] = [], hi = 0;
function drawPicks() {
  const t = propIn.value.trim().toLowerCase().replaceAll(" ", "_");
  picks = props.filter((p) => !t || p.id.includes(t) || p.desc.toLowerCase().includes(t.replaceAll("_", " ")))
    .sort((a, b) => Number(!a.id.startsWith(t)) - Number(!b.id.startsWith(t)) || 0).slice(0, 80);
  hi = Math.min(hi, Math.max(0, picks.length - 1));
  propList.innerHTML = picks.map((p, i) => `<div data-i="${i}" class="${i === hi ? "hi" : ""}"><i>${p.group} · ${p.type}</i><b>${p.id}</b><span>${esc(p.desc)}${p.unit ? ` (${p.unit})` : ""}</span></div>`).join("") ||
    `<div class="none">no property</div>`;
  propList.classList.add("show");
  propList.querySelector(".hi")?.scrollIntoView({ block: "nearest" });
}
function pick(id: string) { propList.classList.remove("show"); update({ prop: id }, true); if (id && q.cmp === "has" && dict.properties.get(id)?.type !== "bool") cmp$.focus(); }
propIn.addEventListener("focus", () => { hi = 0; drawPicks(); });
propIn.addEventListener("input", () => { hi = 0; drawPicks(); if (!propIn.value) update({ prop: "" }, true); });
propIn.addEventListener("blur", () => setTimeout(() => { propList.classList.remove("show"); if (propIn.value !== q.prop) propIn.value = q.prop; }, 150));
propIn.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { hi = Math.max(0, Math.min(picks.length - 1, hi + (ev.key === "ArrowDown" ? 1 : -1))); drawPicks(); ev.preventDefault(); }
  else if (ev.key === "Enter") { const p = picks[hi]; if (p) pick(p.id); }
  else if (ev.key === "Escape") { propList.classList.remove("show"); propIn.blur(); }
});
propList.addEventListener("mousedown", (ev) => { const i = (ev.target as HTMLElement).closest<HTMLElement>("[data-i]")?.dataset.i; if (i) pick(picks[Number(i)]!.id); });

// ---- The list ---------------------------------------------------------------------------------

const ROW = 32, BUFFER = 12;
const scroller = $("scroller"), rows$ = $("rows"), empty$ = $("empty"), count$ = $("count");

function refilter() {
  const t = performance.now();
  rows = search(index, q, lex);
  count$.innerHTML = `<b>${fmt(rows.length)}</b> of ${fmt(index.length)} words`;
  count$.title = `filtered in ${(performance.now() - t).toFixed(0)} ms`;
  rows$.style.height = `${rows.length * ROW}px`;
  empty$.hidden = rows.length > 0;
  scroller.scrollTop = 0;
  draw(true);
}

let drawn = "";
function draw(force = false) {
  const first = Math.max(0, Math.floor(scroller.scrollTop / ROW) - BUFFER);
  const last = Math.min(rows.length, Math.ceil((scroller.scrollTop + scroller.clientHeight) / ROW) + BUFFER);
  const key = `${first}:${last}:${q.w}`;
  if (!force && key === drawn) return;
  drawn = key;
  let html = "";
  for (let i = first; i < last; i++) {
    const e = rows[i]!, s = summary(e.w), f = lex?.[e.w];
    const sortVal = !["word", "length", "freq"].includes(q.sort) ? e.def.set[q.sort] : undefined;
    const note = sortVal !== undefined ? showValue(sortVal, dict.properties.get(q.sort)) : q.sort === "freq" && f ? `zipf ${f[0]}` : q.prop && e.def.set[q.prop] !== undefined ? `${q.prop.replaceAll("_", " ")} ${showValue(e.def.set[q.prop]!)}` : "";
    html += `<div class="row${e.w === q.w ? " sel" : ""}" data-w="${e.w}" style="top:${i * ROW}px"><span class="w" title="${e.w}">${e.w}${note ? `<small>${esc(note)}</small>` : ""}</span>` +
      `<span><span class="role ${e.def.role}">${e.def.role}</span></span><span class="a" title="${e.def.class} · ${e.def.archetype}">${e.def.archetype.replaceAll("_", " ")}</span>` +
      `<span class="s" title="${esc(s.lead.join(" · "))}">${esc(s.lead.join(" · "))}</span><span class="e" title="${esc(s.effect)}">${esc(s.effect)}</span></div>`;
  }
  rows$.innerHTML = html;
}
scroller.addEventListener("scroll", () => requestAnimationFrame(() => draw()));
addEventListener("resize", () => draw(true));
rows$.addEventListener("click", (ev) => { const w = (ev.target as HTMLElement).closest<HTMLElement>("[data-w]")?.dataset.w; if (w) open(w); });

// ---- The detail panel -------------------------------------------------------------------------

const detail = $("detail");
const wordLinks = (list: string[], most = 120) => list.length
  ? `<div class="words">${list.slice(0, most).map((w) => (byWord.has(w) ? `<a data-w="${w}">${w}</a>` : `<span class="chip" title="not a playable word">${w}</span>`)).join("")}${list.length > most ? ` <span class="none">and ${fmt(list.length - most)} more</span>` : ""}</div>`
  : `<div class="none">none</div>`;

function cardHtml(c: { card: Card } | { error: string }): string {
  if ("error" in c) return `<div class="gamecard"><div class="err">${esc(c.error)}</div></div>`;
  const k = c.card;
  return `<div class="gamecard"><div class="title">${esc(k.title)}</div><div class="kind">${esc(k.kind)}</div>` +
    (k.stats.length ? `<ul class="stats">${k.stats.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "") +
    (k.does.length ? `<ul class="does">${k.does.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "") + `</div>`;
}

function open(w: string, push = true) {
  const e = byWord.get(w);
  if (!e) return close();
  q.w = w;
  document.body.classList.add("open");
  if (push) history.replaceState(null, "", location.pathname + toSearch(q));
  const d = e.def, f = lex?.[w], sum = summary(w), kind = d.role === "noun" ? kindOf(dict, w) : null;
  const { ends, endedBy } = countersFor(dict, w);
  const groups = propertyRows(dict, d);
  const ops = opRows(d.ops);
  detail.innerHTML =
    `<div class="top"><div><h2>${w.toUpperCase()}</h2><div class="kind"><span class="role ${d.role}">${d.role}</span> ${esc([d.class, d.archetype, kind].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ").replaceAll("_", " "))}</div>` +
    (f?.[2] ? `<p class="gloss">${esc(f[2])}</p>` : "") +
    `<div class="freq">${f ? `frequency: zipf ${f[0]} · ${f[1]}` : lex ? "no frequency data" : "loading frequency…"}</div></div><button class="close" title="Esc">✕</button></div>` +
    `<div id="art"></div>` +
    `<h3>Card <small>(what the game shows)</small></h3>${cardHtml(cardFor(dict, w))}` +
    `<h3>In the list</h3><ul class="lines"><li>${esc(sum.effect) || '<span class="none">nothing</span>'}</li></ul>` +
    `<h3>Ops <small>(${ops.length} change${ops.length === 1 ? "" : "s"} it makes)</small></h3>` +
    (ops.length ? `<ul class="lines">${ops.map((o) => `<li>${esc(o.text)}<code>${esc(o.raw)}</code></li>`).join("")}</ul>` : `<div class="none">none</div>`) +
    `<h3>Ends <small>(${ends.length})</small></h3>${wordLinks(ends)}` +
    `<h3>Ended by <small>(${endedBy.length})</small></h3>${wordLinks(endedBy)}` +
    `<h3>Properties <small>(${Object.keys(d.set).length}; anything absent is the property's default)</small></h3>` +
    (groups.length ? `<table class="props">${groups.map(([g, list]) => `<tr class="g"><td colspan="3">${g}</td></tr>` +
      list.map((r) => `<tr><td class="id"><a data-prop="${r.id}" title="Filter by ${r.id}">${r.id}</a></td><td class="v">${esc(showValue(r.value, r.prop))}</td><td class="d">${esc(r.prop?.desc ?? "")}</td></tr>`).join("")).join("")}</table>` : `<div class="none">none</div>`);
  detail.scrollTop = 0;
  draw(true);
  void drawArt(w);
}

function close() {
  q.w = "";
  document.body.classList.remove("open");
  history.replaceState(null, "", location.pathname + toSearch(q));
  draw(true);
}

detail.addEventListener("click", (ev) => {
  const el = ev.target as HTMLElement;
  if (el.closest(".close")) return close();
  const w = el.closest<HTMLElement>("[data-w]")?.dataset.w;
  if (w) return open(w);
  const p = el.closest<HTMLElement>("[data-prop]")?.dataset.prop;
  if (p) update({ prop: p, cmp: "has", val: "" }, true);
});

/** The word's look as the game draws it: its generated image if it has one, else its drawn shape. */
async function drawArt(w: string) {
  const host = $("art");
  try {
    const look = lookOf(dict, w);
    await preload([look.noun]);
    if (q.w !== w) return;
    const raster = rasterOf(look.noun);
    const k = Math.min(2, devicePixelRatio || 1), W = 240, H = 200;
    const st = renderStandee(look, { k, raster });
    const c = document.createElement("canvas");
    c.width = W * k; c.height = H * k; c.style.width = `${W}px`; c.style.height = `${H}px`;
    const ctx = c.getContext("2d")!;
    ctx.scale(k, k);
    const fit = Math.min(1.6, (W - 16) / (st.canvas.width / k), (H - 40) / (st.canvas.height / k));
    ctx.drawImage(st.canvas, W / 2 - (st.ox / k) * fit, H - 34 - (st.oy / k) * fit + 4, (st.canvas.width / k) * fit, (st.canvas.height / k) * fit);
    tag(ctx, [w.toUpperCase()], W / 2, H - 16, 0, "#4a3f33", 12);
    host.replaceChildren(c);
    const src = document.createElement("span");
    src.className = "src";
    src.textContent = raster ? "generated image" : "drawn shape";
    host.append(src);
  } catch {
    host.innerHTML = `<span class="none">no art</span>`;
  }
}

// ---- Keys -------------------------------------------------------------------------------------

addEventListener("keydown", (ev) => {
  const typing = ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement;
  if (ev.key === "/" && !typing) { search$.focus(); search$.select(); ev.preventDefault(); return; }
  if (ev.key === "Escape") { if (typing) (ev.target as HTMLElement).blur(); else if (q.w) close(); return; }
  if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && (!typing || ev.target === search$) && rows.length) {
    const i = rows.findIndex((e) => e.w === q.w), next = Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + (ev.key === "ArrowDown" ? 1 : -1)));
    open(rows[next]!.w);
    const top = next * ROW;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + ROW > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + ROW - scroller.clientHeight;
    ev.preventDefault();
  }
  if (ev.key === "Enter" && ev.target === search$ && rows.length) open(rows[0]!.w);
});

// ---- Start ------------------------------------------------------------------------------------

toControls();
refilter();
if (q.w) open(q.w, false);
const ready = performance.now() - t0;
// Frequency and meaning come after the list is up (about 0.5 MB gzipped).
const lexStart = performance.now();
fetch(`${import.meta.env.BASE_URL}words/lexicon.json`).then((r) => (r.ok ? r.json() : null)).then((l: Lex | null) => {
  lex = l;
  (window as unknown as { __words: object }).__words = { ready, lex: performance.now() - lexStart, words: index.length };
  if (q.sort === "freq" || q.gloss) refilter(); else draw(true);
  if (q.w) open(q.w, false);
}).catch(() => { /* no lexicon: the page works without frequency and meaning */ });
(window as unknown as { __words: object }).__words = { ready, words: index.length };
