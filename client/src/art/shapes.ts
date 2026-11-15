/**
 * What each word looks like as a paper standee.
 *
 * `WORDS` (a silhouette for one word) wins over `ARCHETYPES` (one per archetype in
 * data/archetypes.json), which wins over `CLASSES`. To give a word its own look, add it to
 * `WORDS`; anything not listed still gets its archetype's shape, coloured by its own material
 * and colour. See build.ts for the units and the builders.
 */
import {
  at, band, behind, biped, bird, boat, brickWall, bug, car, dino, dot, dragon, E, engine, eye, fish, flower, glue, house, icon, moved, P, part, plane, polearm, quad, R,
  rosette, sign, snake, sym, tank, train, tree, turn, wheel, type Biped, type Piece, type Pt, type Silhouette,
} from "./build.js";

const s = (pieces: Piece[], colour?: string, extra: Partial<Silhouette> = {}): Silhouette => ({ pieces, colour, ...extra });

// ---------------------------------------------------------------------------------------------
// Things you hold, wear and carry

const sword = (len = 30, w = 4, colour = "#d8e0e4"): Silhouette => s([
  part(P(-w / 2, -6, w / 2, -6, w / 2, -6 - len * 0.85, 0, -6 - len, -w / 2, -6 - len * 0.85)),
  glue(R(-7, -7, 7, -4), "#c9a24a"), glue(R(-1.4, -4, 1.4, 2), "#6b4a2e"), glue(E(0, 3, 2.2, 2.2, 8), "#c9a24a"),
  dot(band([[0, -8], [0, -4 - len * 0.85]], 0.8), "light"),
], colour);

const axe = s([part(band([[0, 2], [0, -34]], 3), "#8a6440"), glue(P(1, -32, 12, -38, 14, -28, 12, -18, 1, -24), "body", 1), dot(band([[12, -36], [13.5, -20]], 1.2), "light")], "#c9d1d6");
const spear = s([part(band([[0, 2], [0, -46]], 2.4), "#8a6440"), glue(P(-3.5, -44, 0, -56, 3.5, -44, 0, -42), "body"), glue(R(-2, -44, 2, -41), "#6b4a2e")], "#d8e0e4");
const knife = s([part(P(-1.5, -5, 3, -5, 3, -16, -1.5, -22)), glue(R(-2.5, -5, 3.5, 3), "#6b4a2e")], "#d8e0e4");
const bow = s([part(band(E(-4, -20, 8, 18, 16, -Math.PI / 2, Math.PI / 2), 2.6, 2.6), "body"), dot(band([[-4, -38], [-4, -2]], 0.6), "#fbf7ec"), glue(band([[-14, -20], [10, -20]], 1.2), "#8a6440"), glue(P(10, -22.5, 15, -20, 10, -17.5), "#d8e0e4")], "#8a6440");
const gun = s([part(P(-8, -16, 14, -16, 14, -12, -2, -12, -3, -6, -8, 0, -12, 0, -9, -10, -10, -16)), glue(R(-6, -19, 0, -16), "dark"), dot(R(-2, -12, 1, -9), "dark")], "#4a4a52");
const rifle = s([part(P(-20, -12, -6, -15, 22, -15, 22, -12.5, -2, -12.5, -6, -9, -20, -6)), dot(R(-20, -12, -8, -7), "#8a6440"), glue(R(2, -18, 6, -15), "dark")], "#4a4a52");
const cannon = s([part(band([[-10, -14], [18, -22]], 10, 8), "body", 1), glue(E(-12, -14, 6, 6, 12), "body"), ...wheel(-4, -8, 8), dot(E(19, -22, 3, 3.6, 8), "#2b2a28")], "#3d3d40");
const bomb = s([part(E(0, -11, 11, 11, 18)), glue(R(-3, -24, 3, -20), "dark"), dot(band([[0, -24], [3, -30], [7, -30]], 1), "#c9a77a"), glue(P(6, -34, 9, -30, 6, -28, 9, -27, 5, -26), "#f4c95d"), dot(E(-4, -15, 3, 2, 8), "light")], "#2f2f33");
const shield = s([part(P(-13, -38, 13, -38, 12, -16, 0, 0, -12, -16), "body", 1), dot(P(-9, -34, 9, -34, 8.5, -17, 0, -5, -8.5, -17), "light"), dot(R(-2, -34, 2, -6), "#c9a24a"), dot(R(-9, -24, 9, -20), "#c9a24a")], "#3f6fa8");
const armor = s([part(P(-12, -36, -5, -38, 0, -34, 5, -38, 12, -36, 15, -28, 10, -26, 10, -6, -10, -6, -10, -26, -15, -28), "body", 1), dot(band([[0, -33], [0, -7]], 1), "dark"), dot(R(-10, -14, 10, -12), "dark"), glue(R(-1.5, -4, 1.5, 0), "#8a6440"), glue(R(-8, -1, 8, 1), "#8a6440")], "#b8c2c8");
const helmet = s([part([...E(0, -12, 12, 12, 16, Math.PI, Math.PI * 2), [12, -2], [5, -2], [5, -8], [-12, -8]] as Pt[], "body", 1), dot(R(2, -12, 12, -10), "#2b2a28"), glue(band([[-2, -24], [-8, -32], [-14, -30]], 3, 1), "#c9553f")], "#b8c2c8");
const crown = s([part(P(-14, -2, -14, -20, -8, -10, -4, -24, 0, -12, 4, -24, 8, -10, 14, -20, 14, -2)), dot(E(-7, -6, 2, 2, 8), "#c9553f"), dot(E(0, -6, 2, 2, 8), "#3f6fa8"), dot(E(7, -6, 2, 2, 8), "#5f8a4a")], "#e3b341");
const hat = s([part(P(-16, -3, 16, -3, 10, -6, 9, -18, -9, -18, -10, -6)), dot(R(-9.5, -9, 9.5, -6), "deep")], "#6b4a2e");
const boot = s([part(P(-6, -24, 4, -24, 4, -8, 14, -6, 16, 0, -6, 0), "body", 1), dot(R(-6, -3, 16, 0), "deep")], "#7a4a2e");
const cloak = s([part(P(-6, -36, 6, -36, 15, 0, -15, 0), "body", 1), glue(E(0, -36, 4, 2.5, 8), "#e3b341"), dot(band([[-3, -30], [-8, -2]], 1), "dark"), dot(band([[3, -30], [8, -2]], 1), "dark")], "#7a3a5a");
const ring = s([part(E(0, -10, 9, 9, 16)), dot(E(0, -10, 6, 6, 14), "#fbf7ec"), glue(P(-4, -19, 0, -23, 4, -19, 0, -16), "#7fc4d8")], "#e3b341");
const glove = s([part(P(-6, 0, -7, -14, -9, -20, -7, -21, -4, -16, -4, -24, -2, -24, -1, -17, 0, -25, 2, -25, 2, -17, 4, -23, 6, -23, 5, -14, 6, 0), "body", 1), dot(R(-6, -4, 6, 0), "deep")], "#a8703c");

const key = s([part(E(-10, -10, 7, 7, 14)), dot(E(-10, -10, 3, 3, 10), "#fbf7ec"), part(R(-4, -11.5, 16, -8.5)), part(R(11, -8.5, 13.5, -4)), part(R(15, -8.5, 17, -5))], "#d4a63a");
const hammer = s([part(band([[0, 0], [0, -30]], 3), "#8a6440"), glue(R(-9, -36, 9, -28), "body", 0), dot(R(-9, -36, -6, -28), "dark")], "#7d7f80");
const shovel = s([part(band([[0, -10], [0, -36]], 2.4), "#8a6440"), glue(R(-4, -40, 4, -36), "#8a6440"), glue(P(-6, -12, 6, -12, 6, -5, 0, 0, -6, -5), "body", 1)], "#9aa3a8");
const pick = s([part(band([[0, 0], [0, -32]], 2.6), "#8a6440"), glue(band([[-16, -26], [-6, -33], [6, -33], [16, -26]], 3.4, 2), "body")], "#7d7f80");
const rope = s([part(E(0, -9, 12, 8, 18)), dot(E(0, -9, 6, 3.6, 14), "#fbf7ec"), dot(band([[-9, -12], [9, -6]], 1), "dark"), dot(band([[-9, -6], [9, -12]], 1), "dark"), glue(band([[10, -6], [16, 0]], 3), "body")], "#c9a77a");
const ladder = s([part(band([[-7, 0], [-7, -44]], 2.6)), part(band([[7, 0], [7, -44]], 2.6)), ...[-6, -14, -22, -30, -38].map((y) => part(R(-7, y - 1.2, 7, y + 1.2)))], "#a8703c");
const torch = s([part(band([[0, 0], [1, -24]], 3, 4), "#8a6440"), glue(R(-3, -26, 5, -22), "#6b4a2e"), glue(P(-4, -26, -5, -32, -1, -36, 1, -44, 4, -36, 7, -34, 6, -26), "#d9573b", 1), dot(P(-1, -27, -1, -32, 1.5, -36, 3, -30, 3, -27), "#f4c95d")]);
const lamp = s([part(R(-1.5, -24, 1.5, -2), "#3a3633"), part(R(-6, -2, 6, 0), "#3a3633"), glue(P(-8, -24, 8, -24, 5, -34, -5, -34), "body"), dot(E(0, -22, 4, 2, 8), "#f4d35e")], "#e9b949");
const clock = s([part(R(-8, -40, 8, 0), "#8a6440"), glue(E(0, -30, 7.5, 7.5, 16), "#fbf7ec"), dot(band([[0, -30], [0, -35]], 1), "#2b2a28"), dot(band([[0, -30], [3.5, -29]], 1), "#2b2a28"), dot(E(0, -12, 3, 3, 8), "#e3b341"), dot(band([[0, -22], [0, -14]], 0.8), "#e3b341")]);
const bell = s([part(P(-11, -6, -8, -10, -7, -22, -3, -27, 3, -27, 7, -22, 8, -10, 11, -6), "body", 1), glue(E(0, -4, 2.5, 2.5, 8), "dark"), glue(band(E(0, -28, 3, 3, 8, Math.PI, Math.PI * 2), 1.4), "dark")], "#d4a63a");
const mirror = s([part(E(0, -24, 10, 14, 18), "#c9a24a"), dot(E(0, -24, 7.5, 11.5, 16), "#cfe3ea"), dot(band([[-3, -30], [2, -22]], 1.6), "#fbf7ec"), part(R(-2, -10, 2, 0), "#c9a24a"), part(R(-7, -2, 7, 0), "#c9a24a")]);
const telescope = s([part(band([[-14, -10], [14, -26]], 7, 9)), glue(band([[-16, -9], [-10, -12]], 5), "dark"), part(band([[0, -18], [-6, 0]], 1.6), "#6b4a2e"), part(band([[0, -18], [6, 0]], 1.6), "#6b4a2e")], "#c9a24a");
const compass = s([part(E(0, -11, 11, 11, 18), "#c9a24a"), dot(E(0, -11, 8.5, 8.5, 16), "#fbf7ec"), dot(P(0, -19, 2, -11, 0, -11), "#c9553f"), dot(P(0, -3, -2, -11, 0, -11), "#4a3f33")]);
const phone = s([part(R(-7, -26, 7, 0), "body", 1), dot(R(-5.5, -23, 5.5, -4), "#9cc6d2"), dot(E(0, -2, 1, 1, 6), "#8e8b80")], "#3a3633");
const computer = s([part(R(-14, -30, 14, -10), "body", 1), dot(R(-11.5, -27.5, 11.5, -12.5), "#9cc6d2"), part(R(-2, -10, 2, -4)), part(R(-9, -4, 9, 0)), dot(band([[-7, -22], [3, -22]], 1.2), "#fbf7ec"), dot(band([[-7, -18], [7, -18]], 1.2), "#fbf7ec")], "#4a4a52");
const radio = s([part(R(-14, -18, 14, 0), "body", 1), glue(band([[8, -18], [16, -34]], 1), "#3a3633"), dot(E(-6, -9, 5, 5, 12), "#4a3f33"), dot(R(3, -12, 11, -6), "#f4d35e")], "#a8703c");
const camera = s([part(R(-13, -18, 13, 0), "body", 1), part(R(-5, -22, 3, -18)), glue(E(0, -9, 6.5, 6.5, 14), "#3a3633"), dot(E(0, -9, 3.6, 3.6, 10), "#7aa0b0"), dot(R(7, -16, 11, -14), "#c9553f")], "#4a4a52");
const machine = s([part(R(-16, -28, 16, 0), "body", 1), glue(E(-6, -14, 7, 7, 14), "#8e8b80"), ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return dot(R(-6 + Math.cos(a) * 7 - 1.5, -14 + Math.sin(a) * 7 - 1.5, -6 + Math.cos(a) * 7 + 1.5, -14 + Math.sin(a) * 7 + 1.5), "#8e8b80"); }),
  dot(E(-6, -14, 2.5, 2.5, 8), "#4a4a42"), dot(R(5, -24, 13, -20), "#9be28f"), dot(E(9, -12, 2, 2, 8), "#c9553f"), glue(band([[12, -28], [12, -36], [16, -36]], 2), "#3a3633")], "#8a939e");
const robot = biped({ hat: "helmet", skin: "#b8c2c8", legs: "#8e98a0", colour: "#8e98a0", head: 7 });

const book = s([part(P(-14, -2, 0, -4, 14, -2, 14, -24, 0, -26, -14, -24), "#fbf7ec", 1), glue(P(-15, 0, 0, -2, 15, 0, 15, -2, 0, -4, -15, -2), "body"), dot(band([[0, -4], [0, -26]], 0.8), "#c9b99a"),
  ...[-20, -16, -12].map((y) => dot(R(-11, y, -3, y + 1), "#8a7a60")), ...[-20, -16, -12].map((y) => dot(R(3, y, 11, y + 1), "#8a7a60"))], "#7a3a3a");
const scroll = s([part(R(-10, -30, 10, -4), "#efe4cf"), glue(E(0, -30, 12, 3, 12), "body"), glue(E(0, -4, 12, 3, 12), "body"), ...[-24, -20, -16, -12].map((y) => dot(R(-7, y, 7, y + 1), "#8a7a60"))], "#c9a77a");
const map = s([part(P(-16, -2, -6, -6, 6, -2, 16, -6, 16, -30, 6, -26, -6, -30, -16, -26), "#efe4cf"), dot(P(-6, -6, -6, -30, 6, -26, 6, -2), "#e3d6bc"), dot(band([[-12, -10], [-4, -18], [4, -14], [10, -22]], 1), "#c9553f"), dot(P(9, -25, 13, -21, 11, -20), "#c9553f")]);
const letter = s([part(R(-14, -20, 14, 0), "body"), dot(P(-14, -20, 0, -9, 14, -20), "dark"), glue(E(0, -9, 3, 3, 8), "#c9553f")], "#efe4cf");
const flag = s([part(band([[0, 0], [0, -46]], 2), "#6b4a2e"), glue(P(1, -45, 24, -40, 18, -35, 24, -30, 1, -27), "body"), dot(E(9, -36, 3, 3, 8), "light")], "#c9553f");
const coins = s([...[[-6, 0], [6, 0], [0, -4], [-3, -8], [3, -12]].map(([x, y]) => glue(E(x!, y! - 3, 7, 3, 12), "body")), dot(E(3, -15, 4, 1.5, 8), "light")], "#e3b341");
const moneyBag = s([part([...E(0, -10, 12, 10, 18, -Math.PI * 0.8, Math.PI * 1.8)] as Pt[], "body", 1), part(P(-4, -19, 4, -19, 7, -26, -7, -26)), glue(band([[-5, -20], [5, -20]], 2), "#6b4a2e"), dot(icon.coin()[0]!.pts.map(([x, y]) => [x * 0.6, -10 + y * 0.6] as Pt), "#e3b341")], "#c9a77a");
const ball = s([part(E(0, -10, 10, 10, 18)), dot(band(E(0, -10, 10, 3, 14, 0, Math.PI), 1.2), "#fbf7ec"), dot(band(E(0, -10, 3, 10, 14, -Math.PI / 2, Math.PI / 2), 1.2), "#fbf7ec")], "#d9573b");
const football = s([part(E(0, -9, 13, 8, 18)), dot(band([[-6, -9], [6, -9]], 1), "#fbf7ec"), ...[-3, 0, 3].map((x) => dot(band([[x, -11], [x, -7]], 0.8), "#fbf7ec"))], "#8a4a2e");
const card = s([part(R(-10, -30, 10, 0), "#fbf7ec", 1), glue(R(-12, -28, 8, 2), "#fbf7ec"), dot(icon.heart()[0]!.pts.map(([x, y]) => [-2 + x * 0.7, -13 + y * 0.7] as Pt), "#c9553f")]);
const guitar = s([part([...E(-6, -9, 9, 8, 14), ...E(4, -16, 6, 5.5, 12)] as Pt[], "body", 1), part(E(-6, -9, 9, 8, 14)), part(E(4, -16, 6, 5.5, 12)), part(band([[6, -18], [22, -34]], 3), "#6b4a2e"), glue(R(20, -40, 25, -33), "#6b4a2e"), dot(E(-1, -12, 2.6, 2.6, 8), "#2b2a28")], "#c9773a");
const piano = s([part(P(-20, -30, 16, -30, 20, -14, 20, -8, -20, -8), "body", 1), dot(R(-18, -13, 18, -9), "#fbf7ec"), ...[-14, -8, -2, 4, 10].map((x) => dot(R(x, -13, x + 2, -11), "#2b2a28")), part(R(-18, -8, -15, 0)), part(R(15, -8, 18, 0))], "#2b2a28");

const chest = s([part(R(-15, -15, 15, 0)), glue(P(-15, -15, -14, -21, -9, -25, 0, -26, 9, -25, 14, -21, 15, -15), "light"), dot(R(-11.5, -25, -8.5, 0), "#5a3a20"), dot(R(8.5, -25, 11.5, 0), "#5a3a20"), dot(R(-3, -18, 3, -11), "#e8c45a")], "#a8703c");
const box = s([part(R(-13, -24, 13, 0)), dot(R(-13, -24, 13, -20), "dark"), dot(band([[-13, -12], [13, -12]], 1.2), "dark"), dot(band([[-8, -8], [-8, -16]], 1.2), "dark")], "#c9a77a");
const bag = s([part([...E(0, -10, 11, 10, 16, -Math.PI * 0.7, Math.PI * 1.7)] as Pt[], "body", 1), part(P(-5, -18, 5, -18, 3, -24, -3, -24)), glue(band(E(0, -24, 6, 6, 10, Math.PI, Math.PI * 2), 1.6), "dark")], "#a8703c");
const barrel = s([part(P(-10, 0, -12, -10, -10, -24, 10, -24, 12, -10, 10, 0), "body", 1), dot(band([[-12, -6], [12, -6]], 1.6), "#5a5a5a"), dot(band([[-12, -18], [12, -18]], 1.6), "#5a5a5a"), dot(band([[-3, -1], [-3, -23]], 0.8), "dark"), dot(band([[4, -1], [4, -23]], 0.8), "dark")], "#a8703c");
const bottle = s([part(P(-6, 0, -6, -16, -2, -22, -2, -30, 2, -30, 2, -22, 6, -16, 6, 0), "body", 1), glue(R(-2.5, -33, 2.5, -29), "#a8703c"), dot(R(-4.5, -13, 4.5, -5), "#efe4cf"), dot(band([[-4, -16], [-4, -2]], 1), "light")], "#5f8a6a");
const cup = s([part(P(-8, -16, 8, -16, 6, 0, -6, 0), "body", 1), glue(band(E(8, -9, 4, 4, 10, -Math.PI / 2, Math.PI / 2), 1.8), "body"), dot(E(0, -16, 8, 1.5, 10), "#6b4a2e")], "#efe4cf");
const potion = s([part([...E(0, -9, 9, 9, 16, -Math.PI * 0.35, Math.PI * 1.35), [-2.6, -20], [-2.6, -26], [2.6, -26], [2.6, -20]] as Pt[], "#e9eef0", 1), dot(E(0, -8, 7, 6, 14), "body"), glue(R(-3, -29, 3, -25), "#a8703c"), dot(E(-3, -12, 1.4, 1.4, 6), "#fbf7ec")], "#8a5ac9");
const bed = s([part(R(-24, -12, 24, -4)), part(R(-24, -24, -20, 0), "#8a6440"), part(R(20, -16, 24, 0), "#8a6440"), glue(E(-14, -14, 6, 3, 10), "#fbf7ec"), glue(R(-8, -15, 22, -11), "light")], "#7a9cc0");
const chair = s([part(R(-8, -32, -5, 0)), part(R(-8, -14, 9, -11)), part(R(6, -11, 9, 0)), dot(R(-8, -30, -5, -26), "dark")], "#a8703c");
const table = s([part(R(-20, -18, 20, -14)), part(R(-17, -14, -14, 0)), part(R(14, -14, 17, 0)), dot(R(-20, -15, 20, -14), "dark")], "#a8703c");
const throne = s([part(P(-9, -46, 0, -52, 9, -46, 9, -16, 12, -16, 12, 0, -12, 0, -12, -16, -9, -16)), dot(R(-6, -42, 6, -18), "#c9553f"), glue(R(-12, -18, 12, -14), "light"), dot(E(0, -47, 2, 2, 8), "#3f6fa8")], "#e3b341");

const bread = s([part([...E(0, -6, 14, 8, 18, Math.PI, Math.PI * 2), [14, -2], [-14, -2]] as Pt[], "body", 1), ...[-6, 0, 6].map((x) => dot(band([[x - 2, -10], [x + 2, -6]], 1.2), "light"))], "#c98a4a");
const apple = s([part(E(0, -9, 9, 9, 18)), glue(band([[0, -17], [1, -22]], 1.4), "#6b4a2e"), glue(P(1, -20, 8, -24, 4, -18), "#6f9a50"), dot(E(-3, -12, 2, 3, 8), "light")], "#c9453f");
const cheese = s([part(P(-14, 0, -14, -12, 14, -20, 14, 0), "body", 1), dot(E(-6, -6, 2, 2, 8), "dark"), dot(E(4, -10, 2.5, 2.5, 8), "dark"), dot(E(8, -4, 1.6, 1.6, 8), "dark")], "#e9c24a");
const egg = s([part([...E(0, -10, 7, 10, 18)] as Pt[], "body", 1), dot(E(-2, -13, 1.6, 2.4, 8), "#fbf7ec")], "#f2ead8");
const meat = s([part([...E(-2, -9, 11, 8, 16)] as Pt[], "body", 1), part(band([[6, -6], [16, -2]], 3)), glue(E(17, -3, 3, 3, 8), "#f3ece0"), glue(E(17, 0, 3, 3, 8), "#f3ece0"), dot(E(-4, -11, 5, 3, 10), "light")], "#b5554a");
const mushroom = s([part(R(-3, -12, 3, 0), "#efe4cf"), part([...E(0, -12, 12, 9, 16, Math.PI, Math.PI * 2)] as Pt[], "body", 1), dot(E(-5, -16, 2, 1.6, 8), "#fbf7ec"), dot(E(3, -18, 2.4, 1.8, 8), "#fbf7ec"), dot(E(7, -14, 1.4, 1.2, 8), "#fbf7ec")], "#c9453f");
const grass = s([part(P(-10, 0, -9, -10, -6, -2, -4, -16, -1, -3, 2, -14, 3, -2, 7, -12, 7, -1, 11, -8, 11, 0))], "#7f9b52", { flat: true });

const rock = s([part(P(-14, 0, -15, -8, -8, -16, 2, -18, 11, -12, 15, -4, 14, 0), "body", 1), dot(P(-8, -14, 2, -16, 0, -10, -6, -9), "light")], "#9a948a");
const crystal = s([part(P(-6, 0, -9, -14, -4, -26, 2, -20, 4, -30, 9, -14, 7, 0)), dot(P(-4, -26, -1, -2, 2, -20), "light"), dot(P(4, -30, 3, -2, 9, -14), "dark")], "#7fc4d8");
const ingot = s([part(P(-14, 0, -10, -8, 10, -8, 14, 0)), glue(P(-10, -8, -6, -15, 6, -15, 10, -8), "light")], "#e3b341");
const pile = s([part(P(-16, 0, -12, -8, -4, -12, 2, -16, 9, -10, 14, -6, 16, 0), "body", 2), ...[[-8, -4], [0, -8], [6, -4], [3, -13]].map(([x, y]) => dot(E(x!, y!, 3, 2.2, 8), "dark"))], "#8a7a60");
const puddle = s([part(P(-18, 0, -16, -4, -6, -6, 4, -5, 14, -6, 18, -2, 14, 0), "body", 2), dot(E(-4, -3, 6, 1.2, 10), "light")], "#4d7b8c", { flat: true });
const gas = s([part([...E(-6, -16, 8, 7, 12), ...E(4, -22, 9, 8, 12), ...E(10, -14, 7, 6, 12)] as Pt[], "body", 2), part(E(-6, -16, 8, 7, 12)), part(E(4, -22, 9, 8, 12)), part(E(10, -14, 7, 6, 12)), dot(E(2, -24, 5, 3, 10), "light")], "#d8e2e6", { flies: true });

// Buildings and structures.
const wall = brickWall(64, 3);
const gate = s([part(R(-24, -34, -14, 0)), part(R(14, -34, 24, 0)), part(R(-14, -34, 14, -26)), ...[-24, -19, 14, 19].map((x) => part(R(x, -38, x + 4, -34))), glue(R(-13, -26, 13, 0), "#8a6440"), ...[-8, -3, 2, 7].map((x) => dot(R(x, -26, x + 1.4, 0), "#5a3a20")), dot(R(-13, -14, 13, -12), "#5a3a20")], "#bfb3a0");
const tower = s([part(R(-10, -60, 10, 0)), ...[-10, -4, 3].map((x) => part(R(x, -66, x + 4.5, -60))), glue(P(-12, -64, 0, -82, 12, -64), "#c9775a"), dot(R(-2.5, -50, 2.5, -42), "#3d3a33"), dot(R(-2.5, -30, 2.5, -22), "#3d3a33"), dot(R(-4, -8, 4, 0), "#5a4030")], "#c9bca4");
const bridge = s([part([[-34, -14], [34, -14], [34, -10], ...E(0, 0, 24, 14, 14, 0, -Math.PI).map(([x, y]) => [x, y - 0.01] as Pt).reverse().reverse(), [-34, -10]] as Pt[], "body", 0), dot(R(-34, -16, 34, -14), "dark"), ...[-28, -16, -4, 8, 20, 30].map((x) => glue(R(x, -22, x + 2, -14), "#8a6440")), glue(R(-34, -22, 34, -20.5), "#8a6440")], "#bfb3a0");
const fence = s([...[-20, -10, 0, 10, 20].map((x) => part(P(x - 2.5, 0, x - 2.5, -18, x, -21, x + 2.5, -18, x + 2.5, 0))), part(R(-24, -15, 24, -12)), part(R(-24, -7, 24, -4))], "#c9a77a");
const well = s([part(P(-12, 0, -12, -12, 12, -12, 12, 0), "#bfb3a0"), dot(R(-12, -12, 12, -9), "#9a948a"), part(R(-11, -32, -8, -12), "#8a6440"), part(R(8, -32, 11, -12), "#8a6440"), glue(P(-15, -30, 0, -40, 15, -30), "#c9775a"), dot(band([[0, -30], [0, -18]], 0.8), "#6b4a2e"), glue(R(-2.5, -19, 2.5, -14), "#8a6440")]);
const mine = s([part([...E(0, 0, 20, 22, 16, Math.PI, Math.PI * 2)] as Pt[], "#9a948a", 1), dot([...E(0, 0, 11, 14, 14, Math.PI, Math.PI * 2)] as Pt[], "#2e241c"), glue(R(-13, -17, -10, 0), "#8a6440"), glue(R(10, -17, 13, 0), "#8a6440"), glue(R(-14, -19, 14, -15), "#8a6440"), glue(band([[-18, 0], [18, 0]], 1.4), "#6b4a2e")]);
const farm = s([...house({ roof: "barn", w: 34, h: 22 }).pieces, glue(band([[22, 0], [22, -30]], 7), "#d9c6a0"), glue([...E(22, -30, 3.5, 4, 10, Math.PI, Math.PI * 2)] as Pt[], "#8e98a0")], "#b5554a");
const mill = s([part(P(-10, 0, -7, -34, 7, -34, 10, 0)), glue(P(-9, -34, 0, -42, 9, -34), "#c9775a"), ...[0, 1, 2, 3].map((i) => { const a = i * Math.PI / 2 + 0.4; return glue(band([[0, -36], [Math.cos(a) * 20, -36 + Math.sin(a) * 20]], 5, 6), "#efe4cf"); }), glue(E(0, -36, 2.5, 2.5, 8), "#6b4a2e"), dot(R(-2.5, -8, 2.5, 0), "#8a6a4a")], "#d9c6a0");
const forge = s([...house({ w: 34, h: 22, roof: "flat", roofInk: "#5a5a5a" }).pieces, glue(R(8, -40, 14, -22), "#8a5a40"), dot(R(-6, -14, 6, -4), "#f08a3e"), dot(R(-4, -12, 4, -6), "#f4c95d")], "#9a948a");
const vault = s([part(R(-18, -30, 18, 0)), glue(E(0, -15, 10, 10, 18), "#8e98a0"), dot(E(0, -15, 3, 3, 8), "#4a4a52"), ...[0, 1, 2, 3].map((i) => dot(band([[0, -15], [Math.cos(i * 1.57) * 7, -15 + Math.sin(i * 1.57) * 7]], 1.2), "#4a4a52"))], "#7d7f80");
const dam = s([part(P(-30, 0, -24, -24, 24, -24, 30, 0)), dot(R(-24, -24, 24, -21), "dark"), ...[-12, 0, 12].map((x) => dot(band([[x, -20], [x, 0]], 3, 5), "#9cc6d2"))], "#bfb3a0");
const castle = house({ roof: "battlement", w: 64, h: 30 });
const temple = house({ roof: "columns", w: 50, h: 28, roofInk: "#d9c6a0" });
const tent = house({ roof: "tent", w: 34, h: 22 });
const barn = house({ roof: "barn", w: 40, h: 26 });
const school = house({ w: 52, h: 28, floors: 2, windows: 4, roofInk: "#b5554a", chimney: false, sign: "#3f6fa8" });
const bank = house({ roof: "columns", w: 48, h: 26, roofInk: "#c9bca4" });
const hospital = s([...house({ w: 50, h: 32, floors: 2, windows: 4, roof: "flat", roofInk: "#e9e2d0" }).pieces, glue(R(-4, -46, 4, -34), "#c9553f"), glue(R(-8, -42, 8, -38), "#c9553f")], "#f2ead8");
const office = house({ w: 32, h: 60, floors: 5, windows: 3, roof: "flat", roofInk: "#5a6a7a", wall: "#b8c2c8" });
const shop = house({ w: 40, h: 26, windows: 2, sign: "#c9553f", roofInk: "#3f8a6a", roof: "flat" });
const church = house({ roof: "spire", w: 30, h: 30, roofInk: "#5a6a7a" });
const fort = house({ roof: "battlement", w: 56, h: 22, wall: "#a8916a" });
const bunker = s([part([...E(0, 0, 24, 14, 16, Math.PI, Math.PI * 2)] as Pt[], "body", 1), dot(R(-10, -9, 10, -6), "#2b2a28")], "#8a8a7a");
const road = s([part(P(-30, 0, -22, -8, 22, -8, 30, 0), "#c9a77a"), dot(band([[-18, -4], [-8, -4]], 1.2), "#fbf7ec"), dot(band([[0, -4], [10, -4]], 1.2), "#fbf7ec")], undefined, { flat: true });
const door = s([part(R(-10, -38, 10, 0), "#8a6440"), dot(R(-7, -35, 7, -21), "dark"), dot(R(-7, -18, 7, -3), "dark"), glue(E(6, -18, 1.6, 1.6, 8), "#e3b341")]);
const bench = s([part(R(-20, -12, 20, -9)), part(R(-18, -9, -15, 0)), part(R(15, -9, 18, 0)), part(R(-20, -22, 20, -18))], "#a8703c");
const desk = s([part(R(-20, -18, 20, -14)), part(R(-20, -14, -8, 0)), part(R(17, -14, 20, 0)), dot(R(-18, -11, -10, -7), "dark"), dot(R(-18, -5, -10, -1), "dark")], "#8a6440");
const shelf = s([part(R(-14, -40, 14, 0)), ...[-30, -18, -6].map((y) => dot(R(-12, y - 8, 12, y), "#5a3a20")), ...[-37, -34, -30, -25, -21, -14, -10, -6, 3, 7].map((x, i) => dot(R(x % 24 + (x < -20 ? 26 : 0) - 10, (i < 4 ? -38 : i < 7 ? -26 : -14), x % 24 + (x < -20 ? 26 : 0) - 8, (i < 4 ? -30 : i < 7 ? -18 : -6)), ["#c9553f", "#3f6fa8", "#e3b341", "#5f8a4a"][i % 4]!))], "#a8703c");

// ---------------------------------------------------------------------------------------------
// Creatures and people

const human = biped({ colour: "#3f6fa8" });
const wolf = quad({ len: 40, h: 12, leg: 13, neck: 6, head: 6.5, snout: 7, ear: "point", tail: "bushy", colour: "#8a939e", belly: "#c9cfd4" });
const dog = quad({ len: 32, h: 11, leg: 10, neck: 7, head: 6, snout: 5, ear: "flop", tail: "thin", colour: "#c9955a" });
const fox = quad({ len: 30, h: 9, leg: 8, neck: 5, head: 5.5, snout: 6, ear: "point", tail: "bushy", colour: "#d9773b", belly: "#f3ece0" });
const cat = quad({ len: 26, h: 9, leg: 8, neck: 5, head: 5.5, snout: 1.5, snoutH: 3, ear: "point", tail: "long", colour: "#6b6560" });
const lion = quad({ len: 44, h: 15, leg: 13, neck: 5, head: 7, snout: 4, ear: "round", tail: "tuft", mane: true, colour: "#d9a65a" });
const tiger = quad({ len: 46, h: 14, leg: 12, neck: 4, head: 7, snout: 4, ear: "round", tail: "long", stripes: true, colour: "#e08a3e" });
const bear = quad({ len: 44, h: 20, leg: 11, legW: 6, neck: 2, head: 8, snout: 5, snoutH: 5, ear: "round", tail: "stub", low: true, colour: "#6b4a32" });
const horse = quad({ len: 44, h: 15, leg: 20, legW: 4, neck: 16, head: 6, snout: 9, snoutH: 5, ear: "point", tail: "bushy", colour: "#8a5a3a" });
const cow = quad({ len: 46, h: 18, leg: 13, legW: 5, neck: 4, head: 7, snout: 4, snoutH: 6, ear: "flop", tail: "tuft", horns: "bull", spots: true, colour: "#efe4cf" });
const bull = quad({ len: 46, h: 20, leg: 13, legW: 5.5, neck: 3, head: 8, snout: 4, snoutH: 6, ear: "point", tail: "tuft", horns: "bull", colour: "#5a3a2a" });
const pig = quad({ len: 34, h: 15, leg: 8, legW: 4.5, neck: 1, head: 7, snout: 3, snoutH: 5, ear: "flop", tail: "curl", nose: "#c9777a", colour: "#efaaa5" });
const sheep = quad({ len: 34, h: 15, leg: 10, neck: 5, head: 5, snout: 3, ear: "flop", tail: "stub", wool: true, colour: "#efe9dc" });
const goat = quad({ len: 32, h: 12, leg: 12, neck: 8, head: 5, snout: 5, ear: "point", tail: "stub", horns: "ram", colour: "#c9bca4" });
const deer = quad({ len: 38, h: 12, leg: 18, neck: 12, head: 5.5, snout: 6, ear: "point", tail: "stub", horns: "antler", spots: true, colour: "#b5794a" });
const elephant = quad({ len: 56, h: 26, leg: 16, legW: 8, neck: 2, head: 11, snout: 0, ear: "flop", tail: "thin", trunk: true, tusk: true, colour: "#9a9a9e" });
const camel = quad({ len: 44, h: 14, leg: 22, neck: 14, head: 5, snout: 6, ear: "round", tail: "thin", hump: true, colour: "#d2a86a" });
const rat = quad({ len: 18, h: 7, leg: 4, legW: 2.4, neck: 2, head: 4.4, snout: 4, snoutH: 2.6, ear: "round", tail: "long", nose: "#d98a8a", colour: "#8e8580" });
const rabbit = quad({ len: 18, h: 10, leg: 5, legW: 3, neck: 3, head: 5, snout: 2, ear: "point", tail: "stub", colour: "#c9b8a0" });
const monkey = biped({ h: 26, skin: "#d9b896", hat: "none", tail: true, colour: "#8a5a3a", legs: "body" });
const boar = quad({ len: 36, h: 15, leg: 8, legW: 4.5, neck: 0, head: 7, snout: 4, snoutH: 4.5, ear: "point", tail: "thin", tusk: true, low: true, colour: "#5a4636" });
const donkey = quad({ len: 36, h: 13, leg: 15, neck: 10, head: 5.5, snout: 7, ear: "point", tail: "tuft", colour: "#8e8580" });
const bat = s([behind(P(0, -24, -16, -34, -26, -24, -20, -22, -18, -16, -10, -20, -2, -18), "dark", 1), part(E(0, -22, 5, 6, 12)), part(P(-3, -27, -3, -32, 0, -28, 3, -32, 3, -27)), glue(P(0, -24, 16, -34, 26, -24, 20, -22, 18, -16, 10, -20, 2, -18), "body", 1), eye(2, -24, 0.9)], "#4a3f4a", { living: true, flies: true });
const whale = s([part(P(30, -12, 26, -24, 10, -28, -14, -24, -28, -14, -36, -20, -40, -26, -38, -12, -40, 0, -26, -6, -10, -2, 16, -2, 28, -6), "body", 2), dot(P(26, -10, 10, -6, -10, -6, 10, -4, 26, -6), "#efe4cf"), eye(20, -16, 1.4), glue(band([[16, -28], [14, -38], [10, -42]], 2, 1), "#9cc6d2"), glue(band([[16, -28], [20, -38], [24, -40]], 2, 1), "#9cc6d2")], "#4d6b8a", { living: true });

const eagle = bird({ size: 1.4, beak: 4, hooked: true, flies: true, tail: 5, colour: "#6b4a2e", breast: "#8a6440" });
const hawk = bird({ size: 1.2, beak: 3.5, hooked: true, flies: true, colour: "#8a6440" });
const owl = bird({ size: 1.3, beak: 2, hooked: true, round: true, tail: 1, colour: "#a8865a", breast: "#e6d3a3" });
const chicken = bird({ size: 1.1, beak: 3, crest: true, wattle: true, legs: 5, tail: 3, colour: "#f2ead8" });
const duck = bird({ size: 1.1, beak: 6, legs: 3, tail: 2, colour: "#7a9a6a", breast: "#c9a77a" });
const crow = bird({ size: 1.1, beak: 4.5, colour: "#2f2c33" });
const robin = bird({ size: 0.9, beak: 3, breast: "#d9733b", colour: "#7a6a5a" });
const turkey = bird({ size: 1.4, beak: 3, wattle: true, tail: 8, colour: "#6b4a32" });
const parrot = bird({ size: 1.1, beak: 3.5, hooked: true, crest: true, tail: 7, colour: "#3f9a5a" });

// Animals of the biomes.
const jaguar = quad({ len: 42, h: 12, leg: 11, neck: 4, head: 6.5, snout: 4, ear: "round", tail: "long", spots: true, colour: "#d9a24a", belly: "#f3e6c8" });
const zebra = quad({ len: 42, h: 14, leg: 18, legW: 4, neck: 13, head: 6, snout: 8, snoutH: 5, ear: "point", tail: "tuft", stripes: true, colour: "#f3f1ea" });
const giraffe = quad({ len: 40, h: 14, leg: 26, legW: 3.6, neck: 34, head: 5.5, snout: 7, ear: "point", tail: "tuft", spots: true, colour: "#e0aa5a" });
const hyena = quad({ len: 36, h: 13, leg: 12, neck: 4, head: 6.5, snout: 5, ear: "round", tail: "bushy", spots: true, low: true, colour: "#b59a6a" });
const rhino = quad({ len: 52, h: 22, leg: 12, legW: 7, neck: 1, head: 9, snout: 6, snoutH: 7, ear: "point", tail: "thin", horns: "spike", low: true, colour: "#8e8b86" });
const coyote = quad({ len: 32, h: 10, leg: 10, neck: 6, head: 6, snout: 7, ear: "point", tail: "bushy", colour: "#a8906a", belly: "#e3d6bc" });
const walrus = s([part(P(-22, 0, -24, -10, -14, -18, 4, -20, 14, -16, 18, -8, 20, 0), "body", 2), part(E(14, -14, 8, 7, 12)), glue(band([[14, -9], [13, 2]], 2, 1), "#f3ece0"), glue(band([[18, -9], [18, 2]], 2, 1), "#f3ece0"), dot(E(16, -12, 3, 2, 8), "dark"), eye(16, -17, 1.2)], "#8a6450", { living: true });
const seal = s([part(P(-26, 0, -20, -6, -6, -12, 8, -14, 16, -12, 20, -6, 16, 0), "body", 2), part(E(16, -12, 6, 5, 12)), glue(P(-26, 0, -32, -6, -30, 2), "body"), eye(18, -14, 1.2), dot(E(-2, -4, 12, 2, 12), "light")], "#6a6e78", { living: true });
const crab = s([part(E(0, -8, 11, 6, 16)), ...[-1, 1].flatMap((d) => [behind(band([[d * 8, -6], [d * 14, -3], [d * 16, 0]], 1.4, 1), "deep"), behind(band([[d * 6, -5], [d * 11, -1], [d * 12, 0]], 1.4, 1), "deep"), glue(band([[d * 9, -11], [d * 16, -16]], 2), "body"), glue(P(d * 15, -20, d * 21, -18, d * 19, -14, d * 15, -15), "body")]), eye(-3, -14, 1), eye(3, -14, 1)], "#d9573b", { living: true });
const scorpion = s([part(E(0, -5, 10, 4, 14)), part(band([[-8, -6], [-14, -14], [-10, -22], [-4, -20]], 2.6, 1.4)), glue(P(-4, -20, 0, -18, -3, -16), "#3d2a1e"), ...[-1, 1].map((d) => glue(band([[8, -6], [14, -8 + d * 3], [17, -6 + d * 4]], 1.6), "body")), ...[-4, 0, 4].map((x) => behind(band([[x, -3], [x - 2, 0]], 1, 0.8), "deep"))], "#8a5a2e", { living: true, speck: true });
const lizard = s([part(E(0, -4, 10, 3, 12)), part(E(11, -5, 4.5, 3, 10)), part(band([[-9, -4], [-18, -2], [-26, -4]], 3, 0.8)), ...[-5, 5].flatMap((x) => [behind(band([[x, -3], [x - 2, 0]], 1.2), "deep"), behind(band([[x + 1, -3], [x + 3, 0]], 1.2), "deep")]), eye(13, -6, 0.9)], "#8a9a4a", { living: true });
const crocodile = s([part(E(0, -6, 22, 5, 16)), part(P(20, -9, 40, -7, 40, -3, 20, -2)), part(band([[-20, -6], [-34, -4], [-44, -6]], 5, 1)), ...[-12, 12].map((x) => part(R(x - 2, -4, x + 2, 0))), ...[-14, -6, 2, 10].map((x) => dot(P(x, -11, x + 2, -14, x + 4, -11), "dark")), eye(22, -11, 1.2), dot(band([[24, -5], [39, -5]], 0.6), "#f3ece0")], "#5f7a3a", { living: true });
const turtle = s([part([...E(0, -6, 13, 9, 16, Math.PI, Math.PI * 2), [13, -4], [-13, -4]] as Pt[], "body", 1), part(E(15, -6, 4, 3.4, 10), "#9ab06a"), ...[-8, 8].map((x) => part(R(x - 2.5, -4, x + 2.5, 0), "#9ab06a")), dot(P(-6, -8, 0, -13, 6, -8, 0, -5), "dark"), eye(16, -7, 0.9)], "#6b7a3a", { living: true });
const frog = s([part(E(0, -7, 9, 6.5, 14)), part(E(-4, -13, 3, 3, 8)), part(E(4, -13, 3, 3, 8)), dot(E(-4, -13.5, 1.4, 1.4, 6), "#2b2a28"), dot(E(4, -13.5, 1.4, 1.4, 6), "#2b2a28"), ...[-1, 1].map((d) => part(band([[d * 7, -4], [d * 13, -2], [d * 12, 0]], 2.4, 1.6))), dot(band([[-4, -6], [4, -6]], 0.6), "dark")], "#5f9a4a", { living: true });
const penguin = s([part(E(0, -14, 8, 14, 16)), dot(E(2, -12, 5.5, 10, 14), "#f3f1ea"), glue(P(6, -24, 12, -22, 6, -20), "#e7a43c"), glue(band([[-7, -18], [-11, -8]], 2.4, 1), "body"), ...[-3, 3].map((x) => glue(R(x - 2.5, -1.5, x + 2.5, 0), "#e7a43c")), eye(3, -23, 1)], "#2f2c33", { living: true });
const flamingo = bird({ size: 1, beak: 4, hooked: true, neck: 10, legs: 16, tail: 2, colour: "#e98aa0" });
const heron = bird({ size: 1.1, beak: 8, neck: 9, legs: 13, tail: 2, colour: "#9aa3b0", breast: "#e9eef0" });
const ostrich = bird({ size: 1.6, beak: 3, neck: 14, legs: 16, tail: 4, colour: "#3d3a33", breast: "#f3ece0" });
const vulture = bird({ size: 1.3, beak: 4, hooked: true, flies: true, colour: "#4a3f3a", breast: "#c9a88a" });
const gull = bird({ size: 1, beak: 4, flies: true, colour: "#f3f1ea", breast: "#c9d1d6" });
const pelican = bird({ size: 1.3, beak: 10, legs: 4, colour: "#f3f1ea" });
const goose = bird({ size: 1.3, beak: 4, neck: 6, legs: 4, colour: "#e9e6dc" });
const toucan = bird({ size: 1, beak: 9, colour: "#2f2c33", breast: "#f4c95d" });
const pheasant = bird({ size: 1.1, beak: 3, wattle: true, tail: 12, colour: "#a8603a", breast: "#3f7f6a" });
const gorilla = biped({ h: 40, w: 13, skin: "#3d3a40", hair: "#2b2a28", hat: "none", colour: "#3d3a40", legs: "body", arms: "down" });

const ghost = biped({ ghost: true, hat: "none", arms: "forward", colour: "#f3f1ea" });
const zombie = biped({ arms: "forward", skin: "#9ab88a", hair: "#3d4a33", colour: "#6b7a5a", legs: "#4a4a5a" });
const angel = biped({ robe: true, hat: "halo", wings: "feather", skin: "#f3d9be", hair: "#e3b341", colour: "#fbf7ec" });
const demon = biped({ hat: "horns", wings: "bat", tail: true, skin: "#c9453f", colour: "#7a2a2a", legs: "#3d1a1a" });
const god = biped({ robe: true, h: 52, hat: "halo", beard: "#f3ece0", hair: "#f3ece0", held: "staff", arms: "up", colour: "#f2ead8" });
const alien = biped({ head: 9, skin: "#9be28f", hat: "none", colour: "#5fa3a8", legs: "#3f6f73" });
const giant = biped({ h: 72, w: 13, beard: "#6b4a2e", belt: "#5a3a20", colour: "#8a7a5a", arms: "down" });
const monster = s([...quad({ len: 40, h: 20, leg: 10, legW: 6, neck: 4, head: 9, snout: 6, snoutH: 6, ear: "point", tail: "long", horns: "spike", stripes: true }).pieces, dot(P(28, -26, 30, -22, 32, -26, 34, -22, 36, -26), "#fbf7ec")], "#6a5a9a", { living: true });
const saint = biped({ robe: true, hat: "halo", held: "staff", colour: "#d9c6a0", hair: "#8a6440" });
const soul = s([part(P(0, -40, 8, -28, 7, -14, 3, -4, 0, -10, -3, -2, -7, -14, -8, -28), "body", 2), eye(-2.5, -28, 1.2), eye(2.5, -28, 1.2)], "#cfe3f0", { flies: true, living: true });

const knight = biped({ hat: "helmet", held: "spear", skin: "#b8c2c8", colour: "#b8c2c8", legs: "#8e98a0", cloak: "#c9553f" });
const soldier = biped({ hat: "helmet", skin: "#efcfae", colour: "#6b7a4a", legs: "#4a5a3a", belt: "#3d3a33" });
const king = biped({ hat: "crown", robe: true, cloak: "#7a2a3a", beard: "#8a6440", colour: "#a83a4a" });
const queen = biped({ hat: "crown", robe: true, cloak: "#3f4a8a", hair: "#5a3a24", colour: "#6a5ab0" });
const wizard = biped({ hat: "wizard", robe: true, beard: "#e9e2d0", held: "staff", colour: "#4a4aa0" });
const farmer = biped({ hat: "cap", colour: "#c9955a", legs: "#3f6fa8" });
const thief = biped({ hat: "hood", cloak: "#2f2c33", colour: "#3d3a40", legs: "#2b2a28" });
const doctor = biped({ colour: "#f3f1ea", legs: "#5a6a7a", hair: "#3d2a1e" });
const guard = biped({ hat: "helmet", held: "spear", colour: "#7a4a3a", legs: "#3d3a33" });
const smith = biped({ colour: "#6b4a32", beard: "#3d2a1e", belt: "#3d3a33", legs: "#4a4a52" });
const baby = biped({ h: 20, head: 7, hat: "none", colour: "#efc9d4" });
const priest = biped({ robe: true, colour: "#2f2c33", hair: "#8e8580" });
const spy = biped({ hat: "tophat", colour: "#2f2c33", legs: "#2b2a28" });
const captain = biped({ hat: "cap", colour: "#2f4a7a", belt: "#e3b341", legs: "#2f3a5a" });
const boy = biped({ h: 30, colour: "#5f8a4a", legs: "#3f6fa8" });
const girl = biped({ h: 30, hat: "bun", colour: "#d4476a", legs: "#3f6fa8", robe: true });
const woman = biped({ hat: "bun", robe: true, colour: "#8a5ac9" });
const pirate = biped({ hat: "tophat", colour: "#7a2a2a", beard: "#2b2a28", legs: "#2b2a28" });

/** Several of one figure standing together, the back ones smaller: MEN, PEOPLE, an ARMY. */
export function crowd(one: Silhouette, n = 3): Silhouette {
  const spots: [number, number, number][] = [[-11, -4, 0.72], [11, -4, 0.72], [0, 0, 0.82], [-20, 0, 0.66], [20, 0, 0.66]];
  const order = spots.slice(0, n).sort((a, b) => a[1] - b[1]);
  return { ...one, pieces: order.flatMap(([x, y, k]) => moved(one, x, y, k).pieces), hand: undefined, living: true };
}
export const men = crowd(biped({ colour: "#3f6fa8", legs: "#4a4a52" }), 3);
const folk = crowd(biped({ colour: "#c9775a", legs: "#5a4636", hat: "cap" }), 4);
const troops = crowd(soldier, 4);
const police = crowd(biped({ hat: "cap", colour: "#2f4a7a", legs: "#2f3a5a" }), 3);
const band_ = crowd(biped({ colour: "#8a5ac9", held: "staff" }), 3);
const family = s([...moved(biped({ colour: "#3f6fa8" }), -10, 0, 0.85).pieces, ...moved(woman, 8, 0, 0.82).pieces, ...moved(boy, 0, 2, 0.6).pieces], "#3f6fa8", { living: true });

// A JOHN (a toilet), a BAR of iron, a prison CELL, a STAGE, a FLOOR.
const toilet = s([part(P(-9, -34, 9, -34, 9, -20, -9, -20), "#f3f1ea", 1), part([...E(0, -14, 12, 6, 14, Math.PI, Math.PI * 2), [12, -14], [8, -6], [6, 0], [-6, 0], [-8, -6], [-12, -14]] as Pt[], "#f3f1ea", 1),
  dot(E(0, -14, 9, 3, 12), "#9cc6d2"), glue(R(-6, -31, 6, -28), "#c9d1d6")], "#f3f1ea");
const crowbar = s([part(band([[0, 0], [0, -34], [4, -40], [10, -40]], 2.6), "body"), glue(band([[-1, 0], [-4, 3], [-7, 2]], 2, 1.4), "body"), dot(band([[1, -6], [1, -30]], 0.7), "light")], "#5a6670");
const cell = s([part(R(-18, -38, 18, 0), "#9a948a", 1), dot(R(-12, -32, 12, -8), "#2e2a26"), ...[-8, -3, 2, 7].map((x) => glue(R(x, -32, x + 1.6, -8), "#c9d1d6"))], "#9a948a");
const stage = s([part(R(-30, -14, 30, -6), "#a8703c"), part(R(-30, -6, -26, 0), "#8a6440"), part(R(26, -6, 30, 0), "#8a6440"), glue(P(-30, -40, -22, -40, -24, -14, -30, -14), "#b5354a"), glue(P(30, -40, 22, -40, 24, -14, 30, -14), "#b5354a"), glue(R(-30, -43, 30, -39), "#e3b341")]);
const floor = s([part(P(-28, 0, -20, -10, 20, -10, 28, 0), "#c9a77a"), ...[-12, 0, 12].map((x) => dot(band([[x - 4, 0], [x * 0.8, -10]], 0.8), "dark")), dot(band([[-24, -5], [24, -5]], 0.8), "dark")], undefined, { flat: true });
const post = s([part(R(-2.5, -40, 2.5, 0), "#8a6440"), glue(R(-10, -38, 10, -28), "#efe4cf"), dot(band([[-7, -33], [7, -33]], 1), "#8a7a60")]);

// ---------------------------------------------------------------------------------------------
// Archetypes: one shape for every archetype a word can have.

export const ARCHETYPES: Record<string, Silhouette> = {
  // Artifacts.
  artifact: box, adornment: ring, building: house({ windows: 2 }), clothing: hat, container: chest, currency: coins, device: machine,
  document: scroll, fabric: s([part(P(-14, 0, -16, -22, -4, -24, 8, -20, 16, -24, 14, 0, 4, -3, -4, 0), "body", 1), dot(band([[-10, -18], [-12, -4]], 1), "dark"), dot(band([[4, -18], [6, -4]], 1), "dark")], "#c9775a"),
  fortification: fort, furniture: chair, instrument: guitar, light: lamp, machine, medicine: potion, protection: shield, route: road,
  structure: wall, tool: hammer, toy: ball, vehicle_air: plane(), vehicle_land: car(), vehicle_water: boat(), weapon: sword(),
  // Living things.
  amphibian: frog, mammal: dog, bird: bird({ size: 1.1 }), creature: monster, fish: fish(), insect: bug({ kind: "ant" }), invertebrate: bug({ kind: "spider" }),
  reptile: s([part(E(0, -7, 16, 5, 16)), part(E(18, -9, 6, 4, 12)), part(band([[-14, -7], [-24, -4], [-32, -6]], 5, 1)), ...[-9, 9].map((x) => part(R(x - 2, -6, x + 2, 0))), behind(R(-5, -6, -1, 0)), behind(R(13, -6, 17, 0)), eye(20, -10, 1.1)], "#6f9a50", { living: true }),
  supernatural: ghost, person: human, worker: farmer, leader: king, criminal: thief, fighter: soldier,
  tree: tree(), plant: s([part(band([[0, 0], [0, -18]], 2), "#5f8a4a"), glue(P(0, -8, -10, -14, -12, -22, -2, -16), "body"), glue(P(0, -12, 10, -18, 12, -26, 2, -20), "body"), glue(P(0, -18, -3, -26, 0, -30, 3, -26), "body")], "#6f9a50", { flat: true }),
  shrub: tree({ kind: "bush" }), produce: apple, flower: flower(), fungus: mushroom,
  herb: s([part(band([[0, 0], [0, -14]], 1.6), "#5f8a4a"), glue(P(0, -6, -8, -10, -9, -16, -1, -11), "body"), glue(P(0, -9, 8, -13, 9, -19, 1, -14), "body"), glue(P(0, -13, -3, -20, 0, -23, 3, -20), "body")], "#7fae5a", { flat: true }),
  bodypart: s([part(band([[-12, -4], [12, -16]], 5)), glue(E(-14, -2, 4, 4, 8), "body"), glue(E(-12, -7, 4, 4, 8), "body"), glue(E(14, -15, 4, 4, 8), "body"), glue(E(12, -20, 4, 4, 8), "body")], "#f3ece0"),
  food: bread, drink: s([part(P(-8, -20, 8, -20, 7, 0, -7, 0), "body", 1), glue(band(E(8, -10, 4.5, 5, 10, -Math.PI / 2, Math.PI / 2), 2), "body"), glue([...E(0, -20, 9, 4, 12, Math.PI, Math.PI * 2)] as Pt[], "#fbf7ec")], "#c9955a"),
  // Stuff.
  material: pile, mineral: crystal, gem: crystal, metal: ingot, gas, liquid: puddle, fuel: barrel, poison: s([...potion.pieces, dot(icon.skull().map((p) => p.pts)[0]!.map(([x, y]) => [x * 0.4, -9 + y * 0.4] as Pt), "#f3ece0")], "#7fbf6a"),
  // Land, sky and weather, when spelled as a thing.
  place: sign(icon.house()), natural_object: rock, landform: sign(icon.island()), water: puddle, depression: sign(icon.hole()), elevation: sign(icon.mountain()), rock,
  celestial: s([part(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 7 : 16; return [Math.cos(a) * r, -26 + Math.sin(a) * r] as Pt; }), "body", 0), dot(E(0, -26, 4, 4, 8), "light")], "#f4d35e", { flies: true }),
  phenomenon: sign(icon.spiral()), weather: sign(icon.rain()), season: sign(icon.leaf("#d9773b")),
  // Ideas and happenings: placards and rosettes.
  affliction: sign(icon.skull(), "#7a9a5a"), attribute: rosette(icon.star(), "#3f6fa8"), feeling: rosette(icon.heart(), "#d4476a"),
  knowledge: book, group: flag, possession: moneyBag, quantity: sign(icon.box()), duration: sign(icon.hourglass()),
  act: sign(icon.fist()), event: sign(icon.bang()), exchange: sign(icon.coin()), crime: sign(icon.mask()), travel: sign(icon.foot()), contest: rosette(icon.trophy(), "#e3b341"),
  attack: sign(icon.swords()), ceremony: sign(icon.gift()), conflict: sign(icon.swords(), "#f3dcd4"), repair: sign(icon.bandage()), destruction: sign(icon.bolt("#c9553f")),
  escape: sign(icon.arrow()), disaster: sign(icon.bolt()), rescue: sign(icon.cross("#c9553f")), killing: sign(icon.skull(), "#6a4a4a"),
  // Words that never stand on the map (adjectives, verbs, adverbs) still get a shape, for lists and later use.
  quality: rosette(icon.star("#c9553f"), "#e3b341"), pertaining: rosette(icon.key(), "#5f8a6a"), participle: rosette(icon.arrow("#c9553f"), "#c9775a"), absolute: rosette(icon.eye(), "#2f2c33"),
  transform: sign(icon.spiral()), contact: sign(icon.fist()), social: sign(icon.people()), movement: sign(icon.foot()), transfer: sign(icon.arrow()),
  create: sign(icon.star()), body: sign(icon.heart()), perceive: sign(icon.eye()), combat: sign(icon.swords()), consume: sign(icon.drop("#c9553f")),
  manner: rosette(icon.note(), "#8a5ac9"),
};

/** By class, for an archetype not listed above. */
export const CLASSES: Record<string, Silhouette> = {
  artifact: box, creature: monster, person: human, flora: tree(), consumable: bread, bodypart: ARCHETYPES.bodypart!, material: pile,
  terrain: rock, event: sign(icon.bang()), aura: rosette(icon.star()), knowledge: book, institution: flag, measure: sign(icon.box()),
  world_state: sign(icon.cloud("#b8c2c8")), affliction: sign(icon.skull()), modifier: rosette(icon.star()), spell: sign(icon.spiral()),
};

/** What a word with no data looks like. */
export const FALLBACK: Silhouette = box;

// ---------------------------------------------------------------------------------------------
// Words with a shape of their own, ahead of their archetype. Start with the commonest creature
// and object words; every word added here is one fewer that looks like its archetype.


// Theme 26 and 27 (bugs; stone and ore): lumps, crystals and bug works. Body ink takes the word's own colour.
const rocky = s([part(P(-14, 0, -13, -6, -10, -12, -3, -16, 4, -15, 9, -11, 13, -6, 15, 0)), dot(P(-10, -12, -3, -16, -1, -10, -8, -8), "light"), dot(P(4, -15, 9, -11, 13, -6, 6, -7), "dark"), dot(band([[-4, -5], [2, -9]], 0.7), "dark")]);
const oreLump = s([part(P(-14, 0, -12, -9, -6, -15, 2, -17, 9, -13, 14, -6, 12, 0)), dot(P(-6, -15, 2, -17, 0, -11, -5, -10), "light"), dot(P(9, -13, 14, -6, 7, -6), "dark"), ...[[-8, -6, 0.4], [1, -10, -0.5], [6, -4, 0.8], [-2, -3, -0.2]].map(([x, y, a]) => dot(P(x!, y! - 2, x! + 2.4 * Math.cos(a!), y! + 0.4, x!, y! + 2, x! - 2.4 * Math.cos(a!), y! - 0.4), "#d8dde0"))]);
const gemCut = s([part(P(-11, -12, -6, -18, 6, -18, 11, -12, 0, 0), "body"), dot(P(-6, -18, -3, -12, 3, -12, 6, -18), "light"), dot(P(-11, -12, -3, -12, 0, 0), "dark"), dot(P(-2, -16, 0, -17, 1, -14), "#fbf7ec")]);
const cluster = s([part(P(-12, 0, -13, -10, -9, -18, -6, -8, -3, -24, 1, -12, 5, -20, 8, -8, 12, -13, 13, 0), "body", 0), dot(P(-3, -24, -1, -4, 1, -12), "light"), dot(P(5, -20, 4, -4, 8, -8), "dark"), dot(P(-9, -18, -8, -3, -6, -8), "light")]);
const sheet = s([0, 1, 2, 3].map((i) => part(P(-12 + i, -3 - i * 3.5, 11 + i, -4 - i * 3.5, 13 + i, -1 - i * 3.5, -10 + i, 0 - i * 3.5), i % 2 ? "light" : "body", 0)));
const pebbles = s([[-8, -3, 4], [0, -4, 5], [7, -3, 3.5], [-3, -8, 3.2]].map(([x, y, r]) => part(E(x!, y!, r!, r! * 0.75, 10), "body")), "#a8a296");
const geodeShape = s([part(E(0, -11, 12, 11, 18), "#8a7a6a"), dot(E(1, -11, 8, 7.5, 14), "body"), ...[[-3, -14], [3, -9], [4, -15], [-2, -8]].map(([x, y]) => dot(P(x!, y! + 2, x! + 1.5, y! - 2.5, x! + 3, y! + 2), "light"))], "#9a6ac0");
const stalagmiteShape = s([part(P(-10, 0, -5, -14, -2, -36, 1, -14, 4, -22, 7, -8, 10, 0), "body", 1), dot(band([[-3, -6], [-2, -30]], 0.8), "light")], "#b8ab98");
const cocoon = s([part(E(0, -12, 6.5, 11, 16), "body", 1), ...[-18, -14, -10, -6].map((y) => dot(band([[-6, y], [6, y - 2]], 0.6), "dark")), glue(band([[0, -23], [0, -30]], 0.8), "#c9b99a")], "#f2ead8");
const mound = s([part(P(-18, 0, -12, -8, -5, -16, 0, -18, 6, -15, 13, -7, 18, 0), "body", 2), dot(E(0, -16, 2, 1.4, 8), "#2b2a28"), ...[[-8, -5], [7, -6], [-2, -9]].map(([x, y]) => dot(E(x!, y!, 1, 0.7, 6), "#2b2a28"))], "#a87c50");
const comb = s([part(P(-14, -2, -14, -16, -7, -20, 7, -20, 14, -16, 14, -2), "body", 1), ...[[-7, -14], [0, -14], [7, -14], [-3.5, -8], [3.5, -8]].map(([x, y]) => dot(E(x!, y!, 3, 2.6, 6), "deep"))], "#e9b949");
const spray = s([part(R(-6, -26, 6, 0), "body", 1), glue(R(-3, -31, 3, -26), "#3a3633"), glue(R(3, -31, 8, -29), "#3a3633"), dot(R(-6, -20, 6, -10), "#fbf6ea"), dot(P(-3, -17, 0, -13, 3, -17), "#5f8a4a")], "#c9453f");
const swatter = s([part(band([[0, 2], [0, -24]], 1.6), "#8a8f96"), glue(R(-7, -38, 7, -24), "body", 1), ...[-34, -30, -26].map((y) => dot(band([[-6, y], [6, y]], 0.5), "deep"))], "#c9453f");
const digger = biped({ hat: "helmet", colour: "#6b5a44", belt: "#3a3633" });


// Theme 28 (siege and arms): engines, polearms, guns, armour, walls and the people who man them.
const crossbow = s([part(band([[-14, -16], [14, -16]], 3, 2.4), "#8a6440"), glue(band(E(8, -16, 3, 11, 12, -Math.PI / 2, Math.PI / 2), 2, 2), "body"), dot(band([[8, -27], [-6, -16], [8, -5]], 0.5), "#fbf7ec"), glue(band([[-12, -14], [-12, -6]], 2), "#6b4a2e"), glue(P(14, -18, 19, -16, 14, -14), "#d8e0e4")], "#7d7f80");
const longGun = (colour = "#8a6440", bell = false) => s([part(P(-24, -12, -8, -15, 26, -15, 26, -12.5, -4, -12.5, -8, -9, -24, -6), "body"), dot(R(-8, -15, 26, -13.5), "#5a5a62"), ...(bell ? [glue(P(24, -17, 30, -19, 30, -9, 24, -11), "#c9a24a")] : [glue(R(-2, -18, 1, -15), "#5a5a62")])], colour);
const club = s([part(band([[0, 2], [2, -28]], 2.4, 5), "body", 1), dot(E(1, -22, 1.4, 2, 6), "dark"), dot(E(2, -12, 1.2, 1.6, 6), "dark")], "#8a6440");
const staff = s([part(band([[0, 2], [0, -50]], 2.4), "body"), dot(R(-1.2, -30, 1.2, -26), "dark")], "#8a6440");
const roundShield = s([part(E(0, -16, 13, 13, 18), "body", 1), dot(E(0, -16, 9.5, 9.5, 16), "light"), glue(E(0, -16, 3.6, 3.6, 10), "#c9a24a")], "#8a6440");
const tallShield = s([part(P(-11, -44, 11, -44, 12, -4, 0, 0, -12, -4), "body", 1), dot(P(-8, -40, 8, -40, 9, -7, 0, -4, -9, -7), "light"), dot(R(-1.5, -40, 1.5, -6), "deep")], "#b5554a");
const collar = s([part([...E(0, -10, 12, 7, 16, 0, Math.PI), ...E(0, -12, 7, 4, 12, Math.PI, 0).reverse()] as Pt[], "body", 1), ...[-6, 0, 6].map((x) => dot(E(x, -6, 1.2, 1.2, 6), "dark"))], "#b8c2c8");
const plateArmour = (colour: string, mail = false) => s([...armor.pieces, ...(mail ? Array.from({ length: 12 }, (_, i) => dot(E(-7 + (i % 4) * 4.6, -30 + Math.floor(i / 4) * 7, 1.2, 1.2, 6), "dark")) : [])], colour);
const merlons = (colour = "#bfb3a0", slit = false) => s([part(R(-30, -24, 30, 0)), ...[-30, -18, -6, 6, 18].map((x) => part(R(x, -32, x + 8, -24))), ...(slit ? [-14, 2, 16].map((x) => dot(R(x, -18, x + 2, -6), "#2e2a26")) : []), dot(band([[-30, -12], [30, -12]], 0.6), "dark")], colour);
const machicolations = s([part(R(-30, -40, 30, -30)), ...[-30, -18, -6, 6, 18].map((x) => part(R(x, -46, x + 8, -40))), ...[-24, -12, 0, 12, 24].map((x) => glue(P(x - 4, -30, x + 4, -30, x + 2, -26, x - 2, -26), "dark")), part(R(-24, -26, 24, 0)), glue(P(-6, -26, 6, -26, 2, -14, -2, -14), "#d9573b")], "#bfb3a0");
const portcullis = s([part(R(-18, -40, 18, -36), "#5a5a62"), ...[-15, -9, -3, 3, 9, 15].map((x) => part(P(x - 1.4, -36, x + 1.4, -36, x + 1.4, -2, x, 2, x - 1.4, -2), "body")), ...[-30, -20, -10].map((y) => glue(R(-17, y, 17, y + 2.2), "body"))], "#3d3d40");
const drawbridge = s([part(P(-6, 0, -6, -40, 4, -40, 4, 0), "#8a6440"), glue(P(4, -2, 34, -10, 34, -6, 4, 2), "body", 0), ...[10, 18, 26].map((x) => dot(band([[x, -2 - (x - 4) / 4], [x, 2 - (x - 4) / 4]], 0.8), "dark")), dot(band([[2, -38], [32, -10]], 0.6), "#5a5a62")], "#a8703c");
const petard = s([part(P(-8, 0, -10, -16, -6, -22, 6, -22, 10, -16, 8, 0), "body", 1), glue(R(-10, -4, 10, 0), "#8a6440"), dot(band([[0, -22], [3, -28], [7, -28]], 1), "#c9a77a"), glue(P(6, -32, 9, -28, 6, -26, 9, -25, 5, -24), "#f4c95d")], "#3d3d40");
const soldierOf = (colour: string, held: "spear" | "staff" | "none" = "spear", hat: "helmet" | "cap" | "hood" | "none" = "helmet") => biped({ hat, held, colour, legs: "#4a4a52", belt: "#3d3a33" });

// Theme 29 (mythic beasts and prehistoric giants).
/** Wings put on a four-legged body, behind and in front, at the shoulders. */
const winged = (base: Silhouette, x: number, y: number, k = 1, feather = true): Silhouette => ({
  ...base, flies: true,
  pieces: [behind(at(feather ? P(0, 0, -10, -22, -26, -26, -18, -14, -24, -8, -6, 2) : P(0, 0, -12, -20, -28, -20, -20, -12, -24, -4, -14, -6, -10, 2), x - 4, y, k), "dark", 1),
    ...base.pieces, glue(at(feather ? P(0, 0, -6, -24, -22, -30, -16, -16, -22, -10, -4, 4) : P(0, 0, -8, -22, -26, -24, -18, -14, -22, -6, -12, -8, -8, 4), x, y, k), feather ? "light" : "deep", 1)],
});
const withBeak = (base: Silhouette, x: number, y: number): Silhouette => ({ ...base, pieces: [...base.pieces, glue(P(x, y - 2, x + 7, y + 1, x, y + 3), "#e7a43c")] });
const withHorn = (base: Silhouette, x: number, y: number, ink = "#f4e9c8"): Silhouette => ({ ...base, pieces: [...base.pieces, glue(P(x - 1.5, y, x + 4, y - 11, x + 1.5, y), ink)] });
const lionBody = (colour: string) => quad({ len: 44, h: 15, leg: 13, neck: 5, head: 7, snout: 4, ear: "round", tail: "tuft", mane: true, colour });
const horseBody = (colour: string) => quad({ len: 44, h: 15, leg: 20, legW: 4, neck: 16, head: 6, snout: 9, snoutH: 5, ear: "point", tail: "bushy", colour });
const deerBody = (colour: string) => quad({ len: 38, h: 12, leg: 18, neck: 12, head: 5.5, snout: 6, ear: "point", tail: "stub", horns: "antler", colour });
const merfolk = (colour: string, skin = "#efcfae", tail = "#3f8a8a") => s([part(band([[-2, -16], [-10, -8], [-18, -6], [-26, -10]], 7, 2.4), tail, 1), glue(P(-26, -10, -34, -16, -32, -6, -34, 0), tail), ...moved(biped({ colour, skin, hat: "hair", hair: "#5a3a24" }), 0, -4, 0.75).pieces.filter((_, i) => i > 1)], colour, { living: true });
const serpentFolk = (colour: string, skin: string) => s([...snake(colour).pieces, ...moved(biped({ colour, skin, hat: "hair", hair: "#2b2a28" }), 22, -8, 0.6).pieces.filter((_, i) => i > 1)], colour, { living: true });
const many = (base: Silhouette, offsets: [number, number, number][]): Silhouette => ({ ...base, pieces: offsets.flatMap(([x, y, k]) => moved(base, x, y, k).pieces) });
const sabre = s([...quad({ len: 44, h: 14, leg: 12, neck: 4, head: 7, snout: 4, ear: "round", tail: "stub", colour: "#c9955a", belly: "#f3e6c8" }).pieces, glue(band([[30, -28], [31, -20]], 1.6, 0.6), "#f6f0e2"), glue(band([[33, -28], [34, -21]], 1.6, 0.6), "#f6f0e2")], "#c9955a", { living: true });
const bigSloth = quad({ len: 40, h: 22, leg: 12, legW: 7, neck: 4, head: 7, snout: 4, ear: "round", tail: "stub", low: true, colour: "#8a6a4a" });
const domeBack = s([part([...E(0, -10, 20, 14, 18, Math.PI, Math.PI * 2), [20, -6], [-20, -6]] as Pt[], "body", 1), ...[-12, -4, 4, 12].flatMap((x) => [-16, -10].map((y) => dot(E(x, y, 2.4, 2, 8), "dark"))), part(E(22, -7, 4, 3.4, 10)), part(R(-12, -6, -6, 0)), part(R(8, -6, 14, 0)), glue(E(-22, -8, 4, 3.4, 8), "deep"), eye(23, -8, 1)], "#8a6a4a", { living: true });
const woolly = (b: Silhouette, colour: string) => s([...b.pieces, ...Array.from({ length: 6 }, (_, i) => dot(E(-14 + i * 6, -22 + (i % 2) * 4, 3, 3, 8), "light"))], colour, { living: true });
const elephantKin = (colour: string) => quad({ len: 56, h: 26, leg: 16, legW: 8, neck: 2, head: 11, snout: 0, ear: "flop", tail: "thin", trunk: true, tusk: true, colour });
const smallHorse = (colour: string) => quad({ len: 26, h: 9, leg: 12, legW: 3, neck: 9, head: 4.5, snout: 5, snoutH: 3.5, ear: "point", tail: "thin", colour });
const treeFolk = s([...tree({ h: 60, colour: "#5f8a4a" }).pieces, eye(-4, -22, 1.6), eye(4, -22, 1.6), dot(band([[-4, -16], [4, -16]], 0.8), "#3d2a1e"), glue(band([[-3, -28], [-14, -36], [-18, -32]], 2.4, 1.2), "#6b4a2e"), glue(band([[3, -28], [14, -34], [18, -30]], 2.4, 1.2), "#6b4a2e")], "#5f8a4a", { living: true });
const spirit = (colour: string, hat: "none" | "horns" = "none") => biped({ ghost: true, hat, arms: "up", colour, skin: colour });
/** Two more heads beside the one it has (CERBERUS, an ETTIN): one behind and up, one in front and down, each on its own neck. */
const multiHead = (base: Silhouette, hx: number, hy: number, r: number): Silhouette => ({ ...base, pieces: [
  behind(band([[hx - r * 2.4, hy + r * 1.6], [hx - r * 2.6, hy - r * 1.6]], r * 0.9), "dark"), behind(E(hx - r * 2.6, hy - r * 2, r, r * 0.9, 12), "dark"),
  ...base.pieces, glue(E(hx + r * 0.6, hy + r * 2.2, r, r * 0.9, 12), "light"), eye(hx + r * 1, hy + r * 2, 1.1)] });
const twoHeaded = (base: Silhouette): Silhouette => ({ ...base, pieces: [...base.pieces, part(E(-22, -6, 3.6, 3, 10)), eye(-23, -7, 0.9)] });
const stinger = (base: Silhouette, x: number, y: number): Silhouette => ({ ...base, pieces: [...base.pieces, part(band([[x, y], [x - 8, y - 12], [x - 2, y - 22], [x + 6, y - 20]], 2.6, 1.4), "deep"), glue(P(x + 6, y - 22, x + 11, y - 19, x + 6, y - 17), "#3d2a1e")] });


// Theme 30 (traps and dungeons) and theme 31 (heraldry, courts and fealty).
/** Steel jaws open on the ground, teeth up: a MANTRAP. */
const jaws = (colour = "#7d7f80") => {
  const arc = (k: number) => E(k * 13, -2, 12, 13, 12, -Math.PI, 0);
  const teeth = (k: number): Piece[] => arc(k).slice(1, -1).map(([x, y]) => { const a = Math.atan2(y + 2, x - k * 13); return dot(P(x - Math.sin(a) * 1.6, y + Math.cos(a) * 1.6, x - Math.cos(a) * 4.5, y - Math.sin(a) * 4.5, x + Math.sin(a) * 1.6, y - Math.cos(a) * 1.6), "light"); });
  return s([part(R(-27, -3, 27, 0), "dark"), part(E(0, -2, 6, 3.4, 10), "body"), glue(band(arc(1), 2.2), "body"), glue(band(arc(-1), 2.2), "body"), ...teeth(1), ...teeth(-1),
    dot(band([[0, -2], [8, 4], [16, 2]], 0.9), "dark")], colour);
};
/** Wire coiled along posts: BARBWIRE. */
const wire = (colour = "#8e98a0") => s([
  ...[-20, 0, 20].map((x) => part(R(x - 1.4, -20, x + 1.4, 0), "#6b4a2e")),
  ...Array.from({ length: 7 }, (_, i) => glue(band(E(-18 + i * 6, -13, 4.5, 6, 12), 0.9), "body")),
  ...Array.from({ length: 10 }, (_, i) => dot(at(turn(R(-1.6, -0.4, 1.6, 0.4), i), -20 + i * 4.4, -13 + (i % 2 ? 5 : -5)), "dark")),
], colour);
/** Mines half buried in a patch of dirt: a MINEFIELD. */
const mines = s([part(E(0, -2, 26, 6, 18), "#8a7656"), ...[[-15, -3], [-4, -5], [8, -2], [17, -4], [2, 1], [-10, 1]].map(([x, y]) => glue(E(x!, y!, 3.4, 2.2, 10), "body")), ...[[-15, -5], [-4, -7], [8, -4], [17, -6]].map(([x, y]) => dot(R(x! - 0.6, y! - 2, x! + 0.6, y!), "#c9553f"))], "#4a5a3a", { flat: true });
/** Felled, sharpened logs crossed: an ABATIS. */
const abatisShape = s([...[-14, -4, 6].map((x, i) => part(band([[x - 8, 0], [x + 10, -18 - i * 2]], 3, 2), "body")), ...[-10, 0, 10].map((x) => glue(band([[x + 8, 0], [x - 8, -16]], 2.6, 1.6), "dark")), ...[-14, 0, 14].map((x) => dot(P(x - 2, -18, x, -24, x + 2, -18), "#e6c89a"))], "#8a6440");
/** A stone block hanging in a frame over a pit: a CRUSHER. */
const crusherShape = s([part(R(-18, -44, -14, 0), "#6b4a2e"), part(R(14, -44, 18, 0), "#6b4a2e"), part(R(-18, -46, 18, -42), "#6b4a2e"), dot(band([[0, -42], [0, -34]], 0.8), "#3a3633"), glue(R(-12, -34, 12, -18), "body", 1), dot(R(-12, -22, 12, -18), "dark"), part(E(0, -1, 14, 3, 14), "#2e241c")], "#8d877c");
/** A trapdoor in the ground, its lid hanging open over the dark: a CHUTE. */
const trapdoor = s([part(R(-14, -6, 14, 0), "#8a6440"), dot(R(-11, -5, 11, -1), "#1e1a16"), glue(P(-11, -6, 11, -6, 13, -20, -9, -20), "body", 0), dot(band([[-8, -13], [10, -13]], 0.8), "dark")], "#a8805a", { flat: true });
/** Two cuffs on a chain: FETTERS. */
const cuffs = (colour = "#5a5a62") => s([glue(band(E(-11, -7, 6, 6, 14), 2.4), "body"), glue(band(E(11, -7, 6, 6, 14), 2.4), "body"), ...[-4, 0, 4].map((x) => dot(band(E(x, -7, 2.6, 1.6, 8), 0.9), "dark"))], colour, { flat: true });
/** A wire with a wooden grip at each end: a GARROTE. */
const garroteShape = s([part(R(-18, -10, -12, -6), "#8a6440", 1), part(R(12, -10, 18, -6), "#8a6440", 1), dot(band([[-12, -8], [-4, -2], [4, -2], [12, -8]], 0.7), "body")], "#b8c2c8", { flat: true });
/** A handle with knotted tails: a SCOURGE. */
const scourgeShape = s([part(band([[0, 0], [0, -12]], 3), "#5a3a20"), ...[-8, 0, 8].map((dx) => part(band([[0, -12], [dx * 0.6, -22], [dx, -32]], 1.2, 0.8), "body")), ...[-8, 0, 8].map((dx) => dot(E(dx, -32, 1.6, 1.6, 6), "#8e98a0"))], "#7a4a2e");
/** A long thin cane tube: a BLOWGUN. */
const blowgunShape = s([part(band([[-24, -10], [24, -14]], 2.4), "body"), dot(band([[-22, -10.2], [-14, -11]], 2.6), "dark"), dot(E(24, -14, 1.2, 1.2, 6), "#2b2a28")], "#a8805a");
/** A clamp with a screw: a THUMBSCREW. */
const screwClamp = s([part(R(-10, -10, 10, -4), "body"), part(R(-10, -22, 10, -16), "body"), part(R(-2, -30, 2, -10), "dark"), glue(R(-7, -32, 7, -29), "dark"), dot(R(-10, -16, 10, -10), "#2e2a26")], "#5a5a62");
/** A strapped cage over a snout: a MUZZLE. */
const muzzleShape = s([glue(band(E(0, -12, 10, 8, 14), 1.6), "body"), dot(band([[-10, -12], [10, -12]], 1.2), "body"), dot(band([[0, -20], [0, -4]], 1.2), "body"), part(band([[-10, -12], [-18, -16]], 1.6), "body"), part(band([[10, -12], [18, -16]], 1.6), "body")], "#7a4a2e");
/** A band of cloth with its knot: a BLINDFOLD. */
const blindfoldShape = s([part(P(-16, -14, 16, -14, 14, -6, -14, -6), "body", 1), glue(P(14, -12, 22, -16, 20, -8, 15, -9), "body"), glue(P(14, -10, 20, -4, 16, -2, 14, -7), "dark")], "#2b2a28");
/** A white coat with long sleeves strapped round: a STRAITJACKET. */
const straitjacketShape = s([part(P(-12, -34, 12, -34, 10, -4, -10, -4), "body", 1), part(band([[-12, -30], [10, -18], [14, -22]], 3.4), "light"), part(band([[12, -30], [-10, -20], [-14, -24]], 3.4), "pale"), ...[-24, -14].map((y) => dot(R(-10, y, 10, y + 1.6), "#8a6440"))], "#f4f1ea");
/** A post with an arm and a hanging cage: a GIBBET. */
const gibbetShape = s([part(R(-14, -52, -10, 0), "#6b4a2e"), part(R(-14, -52, 10, -48), "#6b4a2e"), part(band([[-12, -38], [-2, -50]], 1.6), "#6b4a2e"), dot(band([[6, -48], [6, -40]], 0.7), "#3a3633"),
  glue(band(E(6, -32, 5, 8, 12), 1), "#3a3633"), ...[3, 6, 9].map((x) => dot(R(x - 0.4, -39, x + 0.4, -25), "#3a3633")), part(R(-20, -2, -4, 0), "#6b4a2e")], "#6b4a2e");
/** Earth heaped low with a row of stakes: a BREASTWORK. */
const earthwork = (colour = "#8a7656", crescent = false) => s([part(crescent ? P(-28, 0, -24, -10, -10, -16, 10, -16, 24, -10, 28, 0, 18, 0, 10, -8, -10, -8, -18, 0) : P(-28, 0, -22, -12, 22, -12, 28, 0), "body", 2), ...[-18, -9, 0, 9, 18].map((x) => glue(P(x - 1.6, crescent ? -14 : -11, x, crescent ? -22 : -19, x + 1.6, crescent ? -14 : -11), "#8a6440"))], colour);
/** A dark hole with a lip of earth: a FOXHOLE. */
const foxholeShape = s([part(E(0, -2, 16, 6, 16), "#8a7656"), dot(E(0, -2, 11, 3.6, 14), "#2e241c"), glue(R(-18, -6, -10, -2), "#c9b07a"), glue(R(10, -6, 18, -2), "#c9b07a")], "#8a7656", { flat: true });
/** Hedges in a grid: a MAZE. */
const mazeShape = s([part(R(-26, -14, 26, 0), "dark"), ...[[-26, -14, 26, -11], [-26, -3, 10, 0], [-26, -14, -23, 0], [23, -14, 26, 0], [-12, -11, -9, -3], [2, -14, 5, -6], [14, -8, 17, 0]].map(([a, b, c, d]) => glue(R(a!, b!, c!, d!), "body"))], "#5f8a4a", { flat: true });
/** A pipe's mouth in a stone wall: a SEWER. */
const pipeMouth = (colour = "#7d7f80") => s([part(R(-18, -20, 18, 0), "#9a948a", 1), glue(E(0, -9, 9, 8, 16), "body"), dot(E(0, -9, 6.5, 5.6, 14), "#1e1a16"), dot(P(-5, -4, 5, -4, 3, -1, -3, -1), "#6b7a4a")], colour);
/** A banner on a crossbar with a pattern: heraldry. */
const banneret = (field: string, charge: Piece[], tail = false) => s([part(band([[0, 0], [0, -50]], 2), "#6b4a2e"), part(R(-12, -48, 12, -46), "#6b4a2e"), glue(tail ? P(-11, -46, 11, -46, 11, -24, 0, -18, -11, -24) : R(-11, -46, 11, -22), field, 0), ...charge.map((p) => ({ ...p, pts: at(p.pts, 0, -34, 0.7), detail: true, glued: false })), glue(E(0, -52, 2.2, 2.2, 8), "#e3b341")]);
const scepterShape = s([part(band([[0, 0], [0, -34]], 2.2), "body"), glue(E(0, -38, 4.5, 4.5, 12), "body"), dot(E(0, -38, 2, 2, 8), "#c9553f"), glue(R(-4, -6, 4, -3), "dark"), glue(P(-1.4, -43, 0, -48, 1.4, -43), "body")], "#e3b341");
const daisShape = s([part(R(-26, -6, 26, 0), "body", 0), part(R(-20, -12, 20, -6), "light"), dot(R(-26, -4, 26, -2), "#e3b341"), glue(R(-6, -14, 6, -12), "#e3b341")], "#a8323a");
const lord = (colour: string, hat: "crown" | "hair" | "cap" | "helmet" = "crown", cloak = "#a8323a") => biped({ hat, colour, cloak, belt: "#e3b341", legs: "#3d3a40" });
/** A stone block of a jail with barred windows: a CHOKEY, a SLAMMER. */
const lockup = (wall = "#9a948a", w = 40, h = 28) => s([...house({ w, h, roof: "flat", wall, windows: 0 }).pieces,
  ...[-w / 4, w / 4].flatMap((x) => [dot(R(x - 5, -h + 6, x + 5, -h + 15), "#2e2a26"), ...[-3, 0, 3].map((d) => dot(R(x + d - 0.6, -h + 6, x + d + 0.6, -h + 15), "#c9d1d6"))])], wall);
/** A hooded executioner with a broad axe. */
const headsmanShape = (() => { const b = biped({ hat: "hood", colour: "#1e1a16", legs: "#2b2a28", arms: "up" }); const [hx, hy] = b.hand!;
  return s([...b.pieces, glue(band([[hx, hy + 14], [hx, hy - 14]], 2), "#8a6440"), glue(P(hx + 1, hy - 14, hx + 11, hy - 18, hx + 12, hy - 6, hx + 1, hy - 8), "#c9d1d6", 1)], "#1e1a16", { living: true }); })();
const convict = (colour = "#d9d2c0") => s([...biped({ colour, legs: "#8a8478", hat: "hair" }).pieces, ...[-24, -19, -14].map((y) => dot(R(-8, y, 8, y + 1.6), "#4a4a52"))], colour, { living: true });


// Frequency batch 1: the most common words that had no data. People are bipeds by what they do;
// a few new things (a ceiling slab, a plug, a gas cylinder, a doll, a skirt, a playing card).
const ceilingShape = s([part(R(-24, -34, 24, -28), "body", 1), part(R(-22, -28, -18, 0), "#8a7a66"), part(R(18, -28, 22, 0), "#8a7a66"), dot(band([[-20, -31], [20, -31]], 0.8), "dark")], "#e9e2d0");
const plugShape = s([part(R(-8, -16, 8, -4), "body", 1), glue(R(-5, -22, -3, -16), "#c9a24a"), glue(R(3, -22, 5, -16), "#c9a24a"), part(band([[0, -4], [0, 0], [10, 0]], 2.4), "#2b2a28")], "#3a3633");
const cylinderShape = s([part(R(-7, -32, 7, 0), "body", 1), glue(E(0, -32, 7, 2.5, 12), "light"), glue(R(-2.5, -38, 2.5, -33), "#3a3633"), dot(R(-7, -20, 7, -16), "#fbf7ec")], "#c9553f");
const dollShape = s([part(P(-7, -16, 7, -16, 9, 0, -9, 0), "body", 1), part(E(0, -21, 5.5, 5.5, 12), "#f3d6c0"), glue(P(-6, -24, 6, -24, 7, -18, 5, -26, -5, -26, -7, -18), "#c9773a"), dot(E(-2, -21, 0.8, 0.8, 6), "#2b2a28"), dot(E(2, -21, 0.8, 0.8, 6), "#2b2a28")], "#d4476a");
const skirtShape = s([part(P(-8, -20, 8, -20, 20, -2, 10, 0, 0, -2, -10, 0, -20, -2), "body", 1), glue(R(-8.5, -23, 8.5, -19), "dark"), ...[-10, -4, 4, 10].map((x) => dot(band([[x * 0.4, -18], [x, -3]], 0.8), "dark"))], "#3f6fa8", { flat: true });
const picture = (sky = "#9cc6d2", frame = "#fbf7ec") => s([part(R(-14, -30, 14, -6), frame, 1), dot(R(-11, -27, 11, -9), sky), dot(P(-11, -9, -4, -18, 2, -11, 6, -15, 11, -9), "#5f8a4a"), dot(E(6, -22, 2.4, 2.4, 8), "#f4d35e"), part(R(-1.5, -6, 1.5, 0), "#8a6440")]);
const radiator = s([...[-12, -6, 0, 6, 12].map((x) => part(R(x - 2.4, -26, x + 2.4, -2), "body", 1)), glue(R(-15, -6, 15, -3), "dark"), glue(R(-15, -25, 15, -22), "dark"), part(R(-13, -2, -10, 0), "#5a5a5a"), part(R(10, -2, 13, 0), "#5a5a5a")], "#d9d2c6");
const aceShape = s([part(R(-10, -30, 10, 0), "#fbf7ec", 1), dot(P(0, -21, 5, -14, 0, -7, -5, -14), "#2b2a28"), dot(R(-8, -28, -6, -24), "#2b2a28")]);
const pipelineShape = s([part(band([[-30, -10], [30, -10]], 7), "body", 1), ...[-18, 0, 18].map((x) => glue(R(x - 2, -15, x + 2, -5), "dark")), ...[-18, 18].map((x) => part(R(x - 1.5, -6, x + 1.5, 0), "#5a5a5a"))], "#9aa3a8");
const scanShape = s([part(R(-12, -26, 12, -4), "body", 1), dot(R(-9.5, -23.5, 9.5, -6.5), "#7fc4d8"), dot(band([[-9, -15], [9, -15]], 1.2), "#c9553f"), part(R(-2, -4, 2, 0))], "#4a4a52");
const cartShape = s([part(R(-16, -22, 14, -10), "#a8703c"), dot(band([[-16, -16], [14, -16]], 1), "dark"), ...wheel(-6, -6, 6), glue(band([[-16, -14], [-28, -10]], 1.6), "#6b4a2e")], "#a8703c");
const drainShape = s([part(E(0, -4, 14, 5, 18), "#5a5a5a"), ...[-8, -3, 2, 7].map((x) => dot(R(x, -7, x + 2, -1), "#2b2a28"))], "#5a5a5a", { flat: true });
const dotShape = s([part(E(0, -6, 5, 5, 14), "body")], "#2b2a28", { flat: true });
const grave = (colour = "#9a948a") => s([part(P(-8, 0, -8, -18, -5, -23, 5, -23, 8, -18, 8, 0), "body", 1), dot(band([[0, -19], [0, -9]], 1.4), "dark"), dot(band([[-4, -15], [4, -15]], 1.4), "dark"), glue(R(-11, -2, 11, 0), "#6f9a50")], colour);
const job = (colour: string, hat: Biped["hat"] = "hair", o: { legs?: string; robe?: boolean; cloak?: string; belt?: string; arms?: "down" | "forward" | "up"; held?: "staff" | "spear" | "none"; h?: number; beard?: string } = {}) => biped({ colour, hat, legs: o.legs ?? "#3a3633", ...o });


// Frequency batch 2: the next thousand most common words. People are bipeds by what they do;
// new things: a sphere, a traffic cone, a saddle, a coil, a drawer, a sculpture, an oil rig, a
// robot arm, a shotgun, a quad bike, a carriage, a stage flat, a sticker and a pixel.
const sphereShape = s([part(E(0, -12, 12, 12, 20), "body", 1), dot(E(-4, -16, 3.4, 2.6, 10), "light")], "#9aa3a8");
const coneShape = s([part(P(-11, 0, -2, -28, 2, -28, 11, 0), "body", 1), dot(P(-6.5, -12, 6.5, -12, 5, -17, -5, -17), "#fbf7ec"), part(R(-14, -2, 14, 0), "body")], "#e8892e");
const saddleShape = s([part(P(-16, -14, -10, -10, 8, -10, 14, -18, 18, -14, 12, -4, -14, -4, -18, -10), "body", 1), glue(E(-12, -15, 3, 2.5, 8), "deep"), dot(band([[0, -5], [0, 4]], 1), "dark"), glue(R(-3, 3, 3, 5), "#8e98a0")], "#7a4a2e");
const coilShape = s([...[-12, -6, 0, 6, 12].map((x) => part(band(E(x, -12, 3.6, 11, 16), 1.6), "body")), part(band([[-18, -1], [-15.6, -12]], 1.6), "body"), part(band([[15.6, -12], [18, -23]], 1.6), "body")], "#c9773a");
const drawerShape = s([part(R(-14, -16, 14, 0), "body", 1), dot(R(-12, -14, 12, -2), "deep"), glue(R(-4, -9, 4, -7), "#c9a24a")], "#8a6440");
const sculptureShape = (colour = "#cfc7b8") => s([part(R(-9, -10, 9, 0), "#9a948a"), part(P(-6, -10, -8, -24, -2, -36, 4, -34, 2, -26, 8, -18, 4, -10), "body", 2), dot(E(1, -30, 2.4, 2.4, 8), "light")], colour);
const rigShape = s([part(P(-14, 0, -2, -50, 2, -50, 14, 0, 10, 0, 0, -42, -10, 0), "body"), ...[-36, -24, -12].map((y) => part(band([[-14 * (y / -50) - 2, y], [14 * (y / -50) + 2, y]], 1.6), "body")), part(R(-18, -4, 18, 0), "#5a5a5a"), glue(R(-3, -54, 3, -50), "#c9553f")], "#8e98a0");
const armShape = s([part(R(-10, -6, 10, 0), "#4a4a52"), part(band([[0, -6], [-4, -24], [10, -34]], 4), "body", 1), glue(E(-4, -24, 3.4, 3.4, 10), "dark"), glue(P(10, -34, 18, -38, 18, -34, 13, -32, 18, -30, 18, -26), "#3a3633")], "#e6a24a");
const shotgunShape = s([part(P(-22, -12, -6, -15, 24, -15, 24, -11, -2, -11, -6, -8, -22, -5), "body"), dot(band([[-4, -13], [24, -13]], 0.6), "dark"), dot(R(-22, -11, -8, -6), "#6b4a2e")], "#4a4a52");
const quadShape = s([...car({ len: 30, h: 10, cab: "none", r: 6, colour: "#c9553f" }).pieces, glue(band([[2, -16], [6, -22], [12, -22]], 1.6), "#2b2a28"), part(R(-6, -18, 6, -15), "#2b2a28")], "#c9553f");
const carriageShape = (colour = "#2f2c33") => s([part(P(-16, -10, -18, -28, 14, -28, 16, -10), "body", 1), dot(R(-12, -24, -2, -16), "#9cc6d2"), dot(R(2, -24, 12, -16), "#9cc6d2"), glue(R(-20, -31, 18, -28), "#c9a24a"), ...wheel(-11, -6, 7), ...wheel(11, -6, 7), glue(band([[16, -12], [30, -10]], 1.4), "#6b4a2e")], colour);
const flatShape = s([part(R(-26, -36, 26, 0), "#e9e2d0", 1), dot(P(-24, -4, -14, -22, -4, -8, 6, -26, 16, -10, 24, -18, 24, -4), "#7fae5a"), dot(E(14, -28, 4, 4, 10), "#f4d35e"), part(R(-24, -2, -20, 4), "#8a6440"), part(R(20, -2, 24, 4), "#8a6440")]);
const stickerShape = s([part(R(-8, -16, 8, 0), "body", 2), dot(icon.star("#fbf7ec")[0]!.pts.map(([x, y]) => [x * 0.6, y * 0.6 - 8] as Pt), "#fbf7ec")], "#f4c95d", { flat: true });
const pixelShape = s([part(R(-5, -10, 5, 0), "body")], "#c9553f", { flat: true });
const runwayShape = s([part(P(-34, 0, -24, -8, 24, -8, 34, 0), "#4a4a52"), ...[-18, -6, 6, 18].map((x) => dot(band([[x - 3, -4], [x + 3, -4]], 1.2), "#fbf7ec"))]);
const shaftShape = s([part(band([[0, 2], [0, -48]], 2.6), "body"), glue(R(-2, -48, 2, -44), "#7d7f80")], "#8a6440");
const pentagonShape = s([part(P(0, -30, 30, -18, 20, 0, -20, 0, -30, -18), "body", 1), dot(P(0, -22, 18, -15, 12, -4, -12, -4, -18, -15), "#d9d2c6"), dot(P(0, -14, 7, -10, 4, -6, -4, -6, -7, -10), "#7fae5a")], "#9aa3a8", { flat: true });
const bump = (colour: string) => s([part(E(0, -4, 8, 5, 14), "body", 1), dot(E(-2, -6, 2.4, 1.6, 8), "light")], colour, { flat: true });

// Frequency batch 3: the next eleven hundred most common words. People are bipeds by what they
// do; new things: a parachute, a pile of rounds, a waterfall, stairs, a curtain, a gas burner, a
// cog, a tea cosy, a mosaic, a rotor, a slab, scaffolding, a chevron, a tyre, a vase, a wicket, a
// wrapped present, a tooth, an antibody, a timber frame and a pedal.
const parachuteShape = s([part([...E(0, -40, 18, 12, 18, Math.PI, Math.PI * 2)] as Pt[], "body", 1), ...[-12, -4, 4, 12].map((x) => dot(band([[x, -40], [x * 0.8, -41]], 1.4), "dark")),
  ...[-17, -6, 6, 17].map((x) => glue(band([[x, -40], [0, -16]], 0.6), "#4a3f33")), ...moved(biped({ colour: "#5f8a4a", hat: "helmet", arms: "up" }), 0, -2, 0.42).pieces], "#e8892e", { flies: true });
const ammoShape = s([...[-7, 0, 7].map((x) => part([...R(x - 2.6, -14, x + 2.6, 0).slice(0, 2), [x + 2.6, -14], [x, -19], [x - 2.6, -14]] as Pt[], "body", 1)), ...[-7, 0, 7].map((x) => dot(R(x - 2.6, -4, x + 2.6, 0), "#9a7a3a"))], "#c9a24a");
const waterfallShape = (colour = "#7fb4d8") => s([part(P(-26, 0, -26, -40, -10, -44, -6, -36, -6, 0), "#8d877c", 1), part(P(-8, -38, 6, -38, 8, -4, -8, -4), "body"),
  ...[-4, 0, 4].map((x) => dot(band([[x, -34], [x + 1, -8]], 0.8), "light")), part(E(4, -3, 18, 4, 14), "body"), part(P(6, 0, 6, -24, 22, -26, 26, 0), "#8d877c", 1)], colour);
const stairsShape = s([...[0, 1, 2, 3, 4].map((i) => part(R(-20 + i * 8, -8 - i * 8, 20, -i * 8), "body", 1)), ...[0, 1, 2, 3, 4].map((i) => dot(R(-20 + i * 8, -8 - i * 8, 20, -6.6 - i * 8), "light"))], "#bfb3a0");
const curtainShape = s([part(R(-24, -44, 24, -40), "#e3b341"), ...[-18, -6, 6, 18].map((x) => part(P(x - 7, -40, x + 7, -40, x + 6, 0, x - 6, 0), "body", 1)), ...[-18, -6, 6, 18].map((x) => dot(band([[x, -38], [x, -2]], 0.8), "dark"))], "#b5354a");
const burnerShape = s([part(R(-14, -8, 14, 0), "#4a4a52", 1), part(E(0, -9, 10, 2.5, 14), "#2b2a28"), ...[-6, 0, 6].map((x) => glue(P(x - 2.4, -10, x, -18, x + 2.4, -10), "#5f8ac9")), ...[-6, 0, 6].map((x) => dot(P(x - 1.2, -10, x, -14, x + 1.2, -10), "#bfe3f2"))], "#4a4a52");
const cogShape = (colour = "#8e98a0") => s([part(Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 3 === 0 ? 13 : 10.5; return [Math.cos(a) * r, -14 + Math.sin(a) * r] as Pt; }), "body", 0), dot(E(0, -14, 4, 4, 10), "#2b2a28")], colour);
const cozyShape = s([part([...E(0, -2, 14, 18, 18, Math.PI, Math.PI * 2), [14, 0], [-14, 0]] as Pt[], "body", 2), glue(E(0, -21, 3, 3, 8), "light"), ...[-8, 0, 8].map((x) => dot(band([[x, -2], [x * 0.8, -15]], 1.2), "dark"))], "#c9553f");
const mosaicShape = s([part(R(-16, -32, 16, 0), "#bfb3a0", 1), ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => dot(R(-14 + c * 7, -30 + r * 7, -8.5 + c * 7, -24.5 + r * 7), ["#c9553f", "#3f6fa8", "#e3b341", "#5f8a4a", "#8a5ac9"][(r * 3 + c * 2) % 5]!)))]);
const rotorShape = s([part(R(-2, -24, 2, 0), "#5a5a5a"), ...[0, 1, 2].map((i) => glue(turn(P(0, -1.5, 18, -3, 18, 3, 0, 1.5), (i * Math.PI * 2) / 3).map(([x, y]) => [x, y - 26] as Pt), "body")), glue(E(0, -26, 3, 3, 8), "dark")], "#8e98a0");
const slabShape = (colour = "#9a948a") => s([part(P(-24, 0, -24, -10, -18, -16, 24, -16, 24, -6, 18, 0), "body", 1), dot(P(-24, -10, -18, -16, 24, -16, 18, -10), "light")], colour);
const scaffoldShape = s([...[-18, 0, 18].map((x) => part(R(x - 1.4, -48, x + 1.4, 0), "body")), ...[-34, -18].map((y) => part(R(-22, y, 22, y + 3), "#a8703c")), ...[-1, 1].map((d) => dot(band([[-18, d > 0 ? -2 : -18], [0, d > 0 ? -18 : -2]], 1), "dark"))], "#8e98a0");
const chevronShape = (colour = "#e3b341") => s([part(P(-12, -10, 0, -20, 12, -10, 12, -4, 0, -14, -12, -4), "body", 1), part(P(-12, -2, 0, -12, 12, -2, 12, 4, 0, -6, -12, 4).map(([x, y]) => [x, y - 4] as Pt), "body", 1)], colour);
const tyreShape = s([part(E(0, -14, 13, 13, 18), "#2b2a28", 0), dot(E(0, -14, 6, 6, 14), "#8e98a0"), ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return dot(turn(R(-1, -13, 1, -10.5), a).map(([x, y]) => [x, y - 14] as Pt), "#4a4a52"); })]);
const vaseShape = (colour = "#c9773a") => s([part(P(-4, -30, 4, -30, 3, -26, 9, -18, 9, -8, 5, 0, -5, 0, -9, -8, -9, -18, -3, -26), "body", 2), dot(band([[-8, -14], [8, -14]], 1), "dark")], colour);
const wicketShape = s([...[-6, 0, 6].map((x) => part(R(x - 1.2, -26, x + 1.2, 0), "body")), glue(R(-7, -28, 7, -26), "#a8703c")], "#f3ead8");
const giftShape = (colour = "#d4476a") => s([part(R(-12, -20, 12, 0), "body", 1), part(R(-14, -24, 14, -18), "light", 1), dot(R(-2, -24, 2, 0), "#f4d35e"), glue(E(-4, -27, 4, 2.6, 8), "#f4d35e"), glue(E(4, -27, 4, 2.6, 8), "#f4d35e")], colour);
const toothShape = s([part(P(-8, -20, -6, -26, 0, -24, 6, -26, 8, -20, 6, -10, 4, 0, 1, -6, -1, -6, -4, 0, -6, -10), "body", 2)], "#f6f1e6");
const antibodyShape = s([part(band([[0, 0], [0, -14]], 2.4), "body"), part(band([[0, -14], [-9, -26]], 2.4), "body"), part(band([[0, -14], [9, -26]], 2.4), "body"), glue(E(-10, -27, 3, 3, 8), "light"), glue(E(10, -27, 3, 3, 8), "light")], "#7fae5a");
const frameShape = s([part(R(-20, -24, -17, 0), "body"), part(R(17, -24, 20, 0), "body"), part(R(-1.5, -24, 1.5, 0), "body"), part(P(-23, -23, 0, -40, 23, -23, 20, -21, 0, -36, -20, -21), "body"), dot(band([[-18, -2], [0, -22]], 1.2), "dark"), dot(band([[18, -2], [0, -22]], 1.2), "dark")], "#c9a77a");
const pedalShape = s([part(band([[0, -30], [0, -16]], 2.6), "#8e98a0"), glue(E(0, -30, 3.4, 3.4, 10), "#5a5a5a"), part(R(-11, -18, 11, -10), "body", 1), ...[-7, -2.5, 2, 6.5].map((x) => dot(R(x, -16.5, x + 2.2, -11.5), "#5a5a5a")), part(R(-1.5, -10, 1.5, 0), "#5a5a5a")], "#2b2a28");
const torShape = s([part(E(0, -8, 22, 9, 16), "body", 2), part(E(-4, -22, 14, 7, 14), "body", 2), part(E(2, -33, 9, 5, 12), "body", 2), dot(E(-8, -10, 6, 2, 8), "light"), dot(E(-8, -24, 4, 1.6, 8), "light")], "#8d877c");

// Frequency batch 4: the next eleven hundred most common words. People are bipeds by what they
// do; new things: a zeppelin, a chariot, a revolver, a rocket launcher, a wavy kris, a prism, a
// windshield, a mudguard, a hinge, an electrode, a lattice, a pedestal, a piling, a strip light
// and a particle.
const zeppelinShape = s([part(E(0, -34, 30, 10, 24), "body", 2), ...[-18, -6, 6, 18].map((x) => dot(band([[x, -43], [x, -25]], 0.8), "dark")), glue(P(26, -36, 36, -46, 36, -24, 26, -32), "body", 1),
  glue(R(-8, -24, 8, -19), "#4a4a52", 1), ...[-5, 0, 5].map((x) => dot(R(x - 1.4, -23, x + 1.4, -21), "#f4d35e")), dot(band([[-26, -36], [22, -40]], 1), "light")], "#c9ccd0", { flies: true });
const chariotShape = s([...moved(biped({ colour: "#c9553f", hat: "helmet", arms: "forward", h: 30 }), -2, -14, 0.8).pieces, part(P(-12, -26, 12, -26, 18, -6, -12, -6), "body", 1),
  dot(band([[-9, -22], [14, -9]], 1.2), "#e3b341"), dot(E(0, -16, 4, 4, 10), "#e3b341"), glue(band([[14, -9], [34, -12]], 1.6), "#8a6440"), ...wheel(0, -8, 9)], "#a8323a");
const revolverShape = s([part(P(-8, -16, 16, -16, 16, -12.5, 2, -12.5, -2, -6, -8, 0, -12, 0, -9, -10, -10, -16)), glue(E(-2, -14, 4, 3.6, 12), "#2b2a28"), ...[-4, 0].map((x) => dot(E(x, -14, 1, 1, 6), "#8e98a0")), dot(R(-2, -12, 1, -9), "dark")], "#6b6f75");
const launcherShape = s([part(band([[-22, -16], [22, -20]], 7), "body", 2), glue(E(23, -20, 4, 4.4, 10), "#2b2a28"), glue(R(-4, -14, 0, -6), "#4a4a52"), glue(R(4, -14, 8, -6), "#4a4a52"), glue(R(-8, -26, 2, -22), "#2b2a28"), glue(P(-24, -20, -30, -24, -30, -12, -24, -14), "#4a4a52")], "#5f7a4a");
const krisShape = s([part([...Array.from({ length: 9 }, (_, i) => [(i % 2 ? 2.4 : -0.6) + 0.5, -6 - i * 3] as Pt), [0, -34], ...Array.from({ length: 9 }, (_, i) => [(i % 2 ? -0.6 : -3.6), -6 - (8 - i) * 3] as Pt)], "body"), glue(R(-6, -7, 5, -4), "#c9a24a"), glue(band([[0, -4], [-2, 4]], 2.6), "#6b4a2e")], "#cfd6da");
const prismShape = s([part(P(-14, 0, 14, 0, 0, -26), "body", 1), dot(P(-8, -2, 0, -20, 2, -2), "light"), ...["#d4476a", "#e3b341", "#7fae5a", "#3f6fa8"].map((c, i) => dot(band([[10, -10 + i * 2], [26, -4 + i * 4]], 1), c))], "#cfeaf2");
const windshieldShape = s([part(P(-20, 0, -14, -22, 14, -22, 20, 0), "#4a4a52", 1), dot(P(-17, -2, -12, -19, 12, -19, 17, -2), "#9cc6d2"), dot(band([[-8, -16], [-2, -6]], 1.2), "#e9eef0"), dot(band([[2, -3], [12, -10]], 0.8), "#2b2a28")], "#4a4a52");
const fenderShape = s([part([...E(0, -2, 18, 16, 18, Math.PI, Math.PI * 2), [18, -2], [13, -2], ...E(0, -2, 13, 11, 14, Math.PI * 2, Math.PI).slice(1), [-18, -2]] as Pt[], "body", 1), dot(band(E(0, -2, 16, 14, 16, Math.PI * 1.2, Math.PI * 1.6), 1), "light")], "#c9553f");
const hingeShape = s([part(R(-14, -22, -2, 0), "body", 1), part(R(2, -22, 14, 0), "body", 1), glue(R(-2, -23, 2, 1), "#5a5a5a"), ...[-8, 8].flatMap((x) => [dot(E(x, -16, 1.4, 1.4, 6), "#4a4a52"), dot(E(x, -6, 1.4, 1.4, 6), "#4a4a52")])], "#9aa3a8");
const electrodeShape = s([part(R(-3, -30, 3, -6), "body"), glue(R(-5, -6, 5, 0), "#2b2a28", 1), glue(band([[0, -30], [-6, -36], [2, -40], [-3, -46]], 1.2), "#7fc4f2"), dot(E(0, -30, 3, 3, 8), "#f4d35e")], "#c9773a");
const latticeShape = s([part(R(-20, -34, -18, 0), "body"), part(R(18, -34, 20, 0), "body"), ...[-1, 1].flatMap((d) => [-24, -12, 0].map((o) => dot(band([[-18, d > 0 ? o : o - 10], [18, d > 0 ? o - 10 : o]].map(([x, y]) => [x!, Math.max(-34, Math.min(0, y!))] as Pt), 1.4), "body")))], "#8e98a0");
const pedestalShape = (colour = "#d9d2c6") => s([part(R(-14, -4, 14, 0), "body", 1), part(R(-9, -24, 9, -4), "body", 1), part(R(-13, -28, 13, -24), "body", 1), dot(band([[-5, -22], [-5, -6]], 0.8), "dark"), dot(band([[5, -22], [5, -6]], 0.8), "dark")], colour);
const pilingShape = s([...[-12, 0, 12].map((x) => part(R(x - 3.5, -30 + Math.abs(x) * 0.4, x + 3.5, 0), "body", 1)), ...[-12, 0, 12].map((x) => dot(E(x, -30 + Math.abs(x) * 0.4, 3.5, 1.4, 8), "#e6c89a")), dot(R(-20, -6, 20, 0), "#7fb4d8")], "#8a6440");
const stripLight = s([part(R(-22, -24, 22, -18), "#9aa3a8", 1), part(R(-20, -18, 20, -14), "body", 2), dot(R(-18, -17.5, 18, -15), "light"), glue(band([[-14, -24], [-14, -40]], 0.6), "#4a4a52"), glue(band([[14, -24], [14, -40]], 0.6), "#4a4a52")], "#f4f7e0", { flies: true });
const wristShape = s([part(band(E(0, -12, 9, 11, 16), 3), "body", 1), glue(R(-6, -26, 6, -16), "#2b2a28", 1), dot(R(-4.5, -24.5, 4.5, -17.5), "#5fb3c9"), dot(band([[-3, -21], [0, -19], [3, -23]], 0.7), "#e9eef0")], "#3a3a40");
const particle = (colour: string) => s([part(E(0, -14, 9, 9, 16), "body"), dot(E(-3, -17, 3, 3, 8), "light"), ...[0, 1, 2].map((i) => dot(band(turn(E(0, 0, 15, 5, 18), (i * Math.PI) / 3).map(([x, y]) => [x, y - 14] as Pt), 0.5), "dark"))], colour, { flies: true });

// Frequency batch 5: the next eleven hundred most common words. People are bipeds by what they
// do; new things: a bayonet, a tripod, a helix, a floppy disk, a moustache, an orb, a leaf blower,
// a grating, a coulter, a splinter, a hamper, an oculus, a pulpit and a castor.
const bayonetShape = s([...rifle.pieces, glue(P(22, -14.8, 40, -14, 22, -12.7), "#e9eef0"), glue(R(20, -16, 23, -11.5), "#5a5a62")], "#4a4a52");
const tripodShape = s([glue(R(-7, -40, 9, -32), "#2b2a28", 1), glue(E(10, -36, 3, 3, 10), "#5fb3c9"), part(R(-1, -32, 1, -24), "body"), ...[-12, 0, 12].map((x) => part(band([[0, -24], [x, 0]], 1.6), "body"))], "#8e98a0");
const helixShape = s([...Array.from({ length: 10 }, (_, i) => part(band([[-12 * Math.cos(i * 0.9), -4 - i * 4], [-12 * Math.cos((i + 1) * 0.9), -8 - i * 4]], 3), i % 2 ? "body" : "light")), ...Array.from({ length: 10 }, (_, i) => dot(band([[12 * Math.cos(i * 0.9), -4 - i * 4], [12 * Math.cos((i + 1) * 0.9), -8 - i * 4]], 2), "#d4476a"))], "#5f8ac9");
const floppyShape = s([part(P(-12, -24, 10, -24, 12, -22, 12, 0, -12, 0), "body", 1), dot(R(-6, -24, 6, -15), "#b8c2c8"), dot(R(1, -23, 4, -16), "#4a4a52"), dot(R(-8, -11, 8, -1), "#f4f1ea")], "#2b2a28", { flat: true });
const moustacheShape = s([part([...E(-6, -8, 7, 3.6, 12, Math.PI * 0.1, Math.PI * 1.1), [-14, -12], [0, -9]] as Pt[], "body"), part([...E(6, -8, 7, 3.6, 12, -Math.PI * 0.1, Math.PI * 0.9).reverse(), [14, -12], [0, -9]] as Pt[], "body")], "#5a3a24", { flat: true });
const orbShape = (colour = "#8a5ac9") => s([glue(R(-8, -4, 8, 0), "#c9a24a", 1), glue(P(-6, -4, 6, -4, 4, -8, -4, -8), "#c9a24a"), part(E(0, -18, 10, 10, 20), "body", 1), dot(E(-3, -22, 3.4, 2.6, 10), "light"), dot(E(2, -14, 2, 2, 8), "#fbf7ec")], colour);
const blowerShape = s([part(E(-6, -14, 9, 9, 16), "body", 1), dot(E(-6, -14, 5, 5, 12), "dark"), part(band([[2, -10], [22, -4]], 4, 3), "#4a4a52"), glue(band([[-8, -23], [-2, -30], [6, -27]], 1.6), "#2b2a28"), ...[0, 1, 2].map((i) => dot(band([[25, -6 + i * 3], [32, -8 + i * 5]], 0.6), "#9cc6d2"))], "#e3b341");
const gratingShape = s([part(R(-18, -30, 18, -27), "body"), part(R(-18, -3, 18, 0), "body"), ...[-14, -7, 0, 7, 14].map((x) => part(R(x - 1.2, -30, x + 1.2, 0), "body"))], "#5a5a62");
const coulterShape = s([part(band([[0, 4], [0, -36]], 2.6), "#8a6440"), glue(P(-1, -6, 10, -6, 4, 6, -1, 2), "body", 1), dot(band([[9, -5], [4, 4]], 0.8), "light")], "#9aa3a8");
const splinterShape = s([part(P(-14, -2, 12, -6, 16, -5, -12, 0), "body"), part(P(-8, -8, 10, -12, 12, -11, -6, -6), "body"), dot(band([[-10, -1.5], [12, -5]], 0.4), "dark")], "#c9a06a", { flat: true });
const hamperShape = s([part(P(-14, -18, 14, -18, 12, 0, -12, 0), "body", 1), ...[-14, -9, -4].map((y) => dot(band([[-13, y], [13, y]], 0.8), "dark")), glue(band(E(0, -18, 10, 8, 12, Math.PI, Math.PI * 2), 1.6), "#8a6440"), dot(R(-15, -20, 15, -17), "#e9e2d0")], "#c9a06a");
const oculusShape = s([part(R(-20, -40, 20, 0), "#d9d2c6", 1), dot(E(0, -24, 11, 11, 18), "#5a5a62"), dot(E(0, -24, 9, 9, 16), "#9cc6d2"), ...[0, 1, 2, 3].map((i) => dot(turn(R(-9, -0.6, 9, 0.6), (i * Math.PI) / 4).map(([x, y]) => [x, y - 24] as Pt), "#5a5a62"))], "#d9d2c6");
const pulpitShape = s([part(P(-12, -26, 12, -26, 9, 0, -9, 0), "body", 1), part(P(-15, -30, 15, -30, 13, -26, -13, -26), "body", 1), glue(P(-6, -30, 6, -30, 8, -36, -4, -36), "#f4f1ea"), dot(icon.cross("#e3b341")[0]!.pts.map(([x, y]) => [x * 0.5, y * 0.5 - 14] as Pt), "#e3b341"), dot(icon.cross("#e3b341")[1]!.pts.map(([x, y]) => [x * 0.5, y * 0.5 - 14] as Pt), "#e3b341")], "#8a5a3a");
const pencilShape = (colour = "#2b2a28") => s([part(turn(R(-2, -30, 2, -4), 0.35), "body", 1), glue(turn(P(-2, -4, 2, -4, 0, 2), 0.35), "#e6c89a"), dot(turn(P(-0.7, -1, 0.7, -1, 0, 2), 0.35), "body"), dot(turn(R(-2, -30, 2, -26), 0.35), "#c9a24a")], colour);
const hoopShape = s([part(band(E(0, -16, 14, 14, 20), 2.4), "#a8703c", 1), dot(E(0, -16, 12, 12, 18), "#f4f1ea"), ...[0, 1, 2, 3, 4].map((i) => dot(E(Math.cos((i / 5) * Math.PI * 2) * 4, -16 + Math.sin((i / 5) * Math.PI * 2) * 4, 2.6, 2.6, 8), "#d4476a")), dot(E(0, -16, 1.8, 1.8, 8), "#e3b341"), dot(band([[-3, -8], [-6, -4]], 0.8), "#5f8a4a")], "#a8703c");
const castorShape = s([part(P(-6, 0, -7, -16, -4, -22, 4, -22, 7, -16, 6, 0), "body", 1), glue(E(0, -24, 4.5, 3, 10), "#cfd6da"), ...[-2, 0, 2].map((x) => dot(E(x, -24.5, 0.6, 0.6, 6), "#2b2a28"))], "#e9eef0");

export const WORDS: Record<string, Silhouette> = {
  // Animals.
  wolf, dog, fox, cat, lion, tiger, bear, horse, cow, bull, pig, sheep, goat, deer, elephant, camel, rat, mouse: rat, rabbit, monkey, boar, donkey, ass: donkey, bat, whale,
  pet: dog, beast: monster, human, mule: donkey, ox: bull, lamb: sheep, puppy: dog, calf: cow,
  jaguar, leopard: jaguar, cheetah: jaguar, zebra, giraffe, hyena, rhino, coyote, jackal: coyote, walrus, seal, crab, scorpion, lizard, iguana: s(lizard.pieces, "#5f9a5a", { living: true }),
  salamander: s(lizard.pieces, "#d9773b", { living: true }), crocodile, alligator: crocodile, turtle, tortoise: turtle, frog, toad: s(frog.pieces, "#8a7a4a", { living: true }), penguin,
  flamingo, heron, ostrich, vulture, gull, pelican, goose, toucan, pheasant, gorilla, sloth: s(monkey.pieces, "#8a7a5a", { living: true }),
  hare: rabbit, squirrel: quad({ len: 14, h: 7, leg: 4, neck: 3, head: 4, snout: 2, ear: "point", tail: "bushy", colour: "#a8603a" }), badger: quad({ len: 26, h: 9, leg: 5, neck: 1, head: 5.5, snout: 4, ear: "round", tail: "stub", low: true, stripes: true, colour: "#6a6a70" }),
  lynx: quad({ len: 30, h: 11, leg: 11, neck: 5, head: 6, snout: 2, ear: "point", tail: "stub", spots: true, colour: "#b59a7a" }), beaver: quad({ len: 24, h: 9, leg: 4, neck: 2, head: 5.5, snout: 3, ear: "round", tail: "stub", low: true, colour: "#7a5a3a" }),
  otter: quad({ len: 28, h: 7, leg: 4, neck: 3, head: 4.5, snout: 3, ear: "round", tail: "long", low: true, colour: "#6a4a32" }), lemming: rat, caribou: deer, reindeer: deer, elk: deer, moose: deer,
  yak: quad({ len: 44, h: 18, leg: 11, legW: 5, neck: 2, head: 7, snout: 4, snoutH: 6, ear: "flop", tail: "tuft", horns: "bull", wool: true, colour: "#4a3a2e" }),
  buffalo: bull, bison: bull, antelope: deer, gazelle: deer, mammoth: elephant,
  eagle, hawk, owl, chicken, cock: chicken, duck, crow, robin, turkey, parrot, jay: bird({ size: 1, crest: true, colour: "#3f6fa8" }), martin: bird({ size: 0.9, colour: "#3f4a6a", tail: 6 }), chat: robin,
  fish: fish(), shark: fish({ shark: true, len: 40, colour: "#7d8a99" }), bass: fish({ colour: "#6f8a5a" }), sole: fish({ colour: "#c9a77a", len: 22 }),
  ant: bug({ kind: "ant", colour: "#4a2e22" }), bee: bug({ kind: "bee", colour: "#e3b341" }), cricket: bug({ kind: "cricket", colour: "#6f8a4a" }), spider: bug({ kind: "spider" }),
  snake: snake("#6f9a50"),
  dragon: dragon(), ghost, zombie, angel, demon, devil: demon, god, alien, giant, monster, saint, soul,
  // People.
  knight, soldier, king, queen, wizard, farmer, thief, doctor, guard, smith, baby, priest, spy, captain, boy, girl, woman, pirate,
  man: human, person: human, people: folk, child: boy,
  // Groups of people: several of them, not a flag.
  men, folk, crowd: folk, mob: folk, gang: crowd(thief, 3), crew: crowd(captain, 3), team: men, staff: men,
  family, army: troops, troops, troop: troops, unit: troops, platoon: troops, squad: troops, militia: troops, police, band: band_, community: folk, population: folk, tribe: folk,
  // Structures that are not walls.
  john: toilet, toilet, bar: crowbar, crowbar, cell, jail: cell, prison: cell, stage, floor, post, room: house({ windows: 1 }), station: house({ w: 48, h: 24, roof: "flat", sign: "#3f6fa8" }),
  base: fort, story: book, study: book, block: brickWall(24, 2), prince: biped({ hat: "crown", colour: "#3f6fa8", cloak: "#c9553f" }), princess: biped({ hat: "crown", robe: true, colour: "#e0708f" }),
  warrior: soldier, fighter: soldier, champion: knight, cop: biped({ hat: "cap", colour: "#2f4a7a", legs: "#2f3a5a" }), marine: soldier, killer: thief, criminal: thief, miner: biped({ hat: "helmet", colour: "#7a6a4a", held: "spear" }),
  merchant: biped({ hat: "tophat", colour: "#7a5a3a", belt: "#e3b341" }), boss: biped({ hat: "tophat", colour: "#2f2c33" }), bishop: priest, coach: captain, commander: captain, colonel: captain,
  // Professions (dictionary theme 1): a look for the commonest, the rest by archetype.
  chef: biped({ hat: "bun", colour: "#f6f2ea", legs: "#3a3633", belt: "#c9453f" }), cook: biped({ hat: "bun", colour: "#f6f2ea", legs: "#3a3633" }),
  baker: biped({ hat: "bun", colour: "#efe4cf", legs: "#8a6a4a" }), butcher: biped({ colour: "#f2ead8", legs: "#3a3633", belt: "#c9453f" }),
  nurse: biped({ colour: "#9cc6d2", legs: "#9cc6d2", hair: "#3d2a1e" }), surgeon: biped({ colour: "#7fae8a", legs: "#7fae8a", hat: "cap" }),
  judge: biped({ robe: true, colour: "#2b2a28", hair: "#efe9dc" }), lawyer: biped({ hat: "tophat", colour: "#3a3633", belt: "#c9a24a" }),
  sheriff: biped({ hat: "cap", colour: "#a8703c", legs: "#3f4a6a", belt: "#e3b341" }),
  policeman: biped({ hat: "cap", colour: "#2f4a7a", legs: "#2f3a5a" }), scout: biped({ hat: "hood", colour: "#5f7a4a", legs: "#4a3f33", arms: "forward" }),
  explorer: biped({ hat: "cap", colour: "#c9a77a", legs: "#6b4a2e", held: "staff" }), hunter: biped({ hat: "hood", colour: "#6f5a3a", legs: "#4a3f33", held: "spear" }),
  builder: biped({ hat: "helmet", colour: "#e8892e", legs: "#3f6fa8" }), mason: biped({ hat: "cap", colour: "#b3b0a8", legs: "#6a6e78" }),
  carpenter: biped({ hat: "cap", colour: "#a8703c", legs: "#3f6fa8" }), lumberjack: biped({ hat: "cap", colour: "#c9453f", legs: "#3f4a6a", beard: "#6b4a2e" }),
  monk: biped({ robe: true, hat: "hood", colour: "#a8703c" }), preacher: biped({ robe: true, colour: "#2f2c33", arms: "up" }),
  teacher: biped({ colour: "#7a5a8a", legs: "#3a3633", hair: "#6b4a2e" }), musician: biped({ colour: "#8a5ac9", legs: "#3a3633", arms: "forward" }),
  trader: biped({ hat: "tophat", colour: "#5f8a6a", belt: "#e3b341" }), banker: biped({ hat: "tophat", colour: "#3a3633", belt: "#e3b341" }),
  gardener: biped({ hat: "cap", colour: "#6f9a50", legs: "#8a6a4a" }), shepherd: biped({ hat: "hood", colour: "#efe9dc", legs: "#8a6a4a", held: "staff" }),
  // Weapons and armour.
  sword: sword(), blade: sword(26), axe, spear, knife, dagger: knife, bow, gun, pistol: gun, rifle, cannon, bomb, grenade: s(bomb.pieces.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * 0.7, y * 0.7] as Pt) })), "#5f6a3a"),
  club: s([part(P(-2, 0, 2, 0, 5, -26, 3, -34, -3, -34, -5, -26), "body", 2), dot(E(1, -28, 1.4, 1.4, 6), "dark"), dot(E(-2, -22, 1.2, 1.2, 6), "dark")], "#8a6440"),
  whip: s([part(band([[0, 0], [0, -10]], 3), "#5a3a20"), part(band([[0, -10], [6, -22], [16, -24], [22, -14], [16, -8]], 1.6, 0.6), "body")], "#7a4a2e"),
  shield, armor, armour: armor, helmet, mail: armor, mask: s([part(P(-12, -24, 12, -24, 11, -14, 4, -10, 0, -13, -4, -10, -11, -14), "body", 1), dot(E(-5, -19, 2.5, 1.8, 8), "#2b2a28"), dot(E(5, -19, 2.5, 1.8, 8), "#2b2a28"), glue(band([[-12, -20], [-18, -22]], 1), "#6b4a2e")], "#f2ead8"),
  crown, hat, cap: s([part([...E(0, -4, 10, 9, 14, Math.PI, Math.PI * 2), [18, -4], [18, -2], [-10, -2]] as Pt[], "body", 1)], "#3f6fa8"), boot, cloak, cape: cloak, ring, glove,
  belt: s([part(band(E(0, -8, 14, 6, 18), 3)), glue(R(-4, -6, 4, 2), "#e3b341")], "#6b4a2e"), dress: biped({ robe: true, hat: "none", colour: "#d4476a" }), coat: cloak,
  // Tools and gadgets.
  key, hammer, saw: s([part(P(-18, -8, 14, -14, 14, -6, -18, -2)), dot(band(Array.from({ length: 12 }, (_, i) => [-17 + i * 2.6, -2 - i * 0.35 + (i % 2) * 1.6] as Pt), 1.2), "dark"), glue(P(14, -16, 22, -16, 22, -4, 14, -4), "#8a6440")], "#c9d1d6"),
  shovel, pick, rope, ladder, torch, lamp, clock, watch: s([part(band(E(0, -12, 8, 12, 12, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4), 4), "#6b4a2e"), part(E(0, -12, 7, 7, 14)), dot(E(0, -12, 5.5, 5.5, 12), "#fbf7ec"), dot(band([[0, -12], [0, -16]], 0.8), "#2b2a28")], "#c9a24a"),
  bell, mirror, telescope, compass, phone, computer, laptop: computer, radio, camera, machine, robot, android: robot, engine: machine, magnet: s([part(band(E(0, -14, 10, 12, 14, Math.PI, Math.PI * 2), 6)), glue(R(-13, -14, -7, -6), "#d8e0e4"), glue(R(7, -14, 13, -6), "#d8e0e4")], "#c9453f"),
  net: s([part(band(E(0, -16, 12, 12, 16), 1.8)), ...[-6, 0, 6].map((x) => dot(band([[x, -27], [x, -5]], 1), "body")), ...[-22, -16, -10].map((y) => dot(band([[-11, y], [11, y]], 1), "body")), glue(band([[10, -8], [20, 0]], 2.4), "#8a6440")], "#c9a77a"),
  // Paper.
  book, map, letter, scroll, bible: book, card, cards: card, flag, banner: flag, money: moneyBag, cash: coins, coin: coins, gold: ingot, silver: s(ingot.pieces, "#c9d1d6"),
  // Containers and furniture.
  chest, box, bag, barrel, bottle, cup, potion, bed, chair, table, throne, bench, desk, shelf, seat: chair,
  bin: s([part(P(-10, 0, -12, -24, 12, -24, 10, 0), "body", 1), glue(R(-13, -27, 13, -24), "dark"), ...[-5, 0, 5].map((x) => dot(band([[x, -21], [x, -3]], 1.2), "dark"))], "#7d8a99"),
  bowl: s([part([...E(0, -10, 13, 10, 16, 0, Math.PI), [13, -10]] as Pt[], "body", 1), dot(E(0, -10, 13, 2.4, 14), "dark")], "#c9775a"),
  // Toys and music.
  ball, football, baseball: s(ball.pieces, "#f2ead8"), basketball: s(ball.pieces, "#d9773b"), toy: rabbit, guitar, piano,
  // Vehicles.
  car: car(), truck: car({ cab: "truck", len: 52, h: 14, wheels: 3, colour: "#3f6fa8" }), bus: car({ cab: "bus", len: 60, h: 14, wheels: 2, colour: "#e3b341" }),
  tank: tank(), train: train(), wagon: s([part(R(-20, -24, 20, -8), "#a8703c"), dot(band([[-20, -16], [20, -16]], 1), "dark"), ...wheel(-12, -7, 7), ...wheel(12, -7, 7), glue(band([[20, -12], [34, -6]], 1.6), "#6b4a2e")]),
  bike: s([...wheel(-12, -8, 8), ...wheel(12, -8, 8), part(band([[-12, -8], [-2, -20], [10, -20], [12, -8]], 2)), part(band([[-2, -8], [-2, -20]], 2)), glue(band([[-2, -20], [-4, -24], [2, -24]], 2), "#3a3633"), glue(band([[10, -20], [9, -26], [13, -27]], 2), "#3a3633")], "#c9453f"),
  cycle: s([...wheel(-12, -8, 8), ...wheel(12, -8, 8), part(band([[-12, -8], [-2, -20], [10, -20], [12, -8]], 2))], "#3f6fa8"),
  boat: boat(), ship: boat({ kind: "ship" }), submarine: boat({ kind: "sub" }), sub: boat({ kind: "sub" }), carrier: boat({ kind: "ship", colour: "#7d8a99" }),
  plane: plane(), jet: plane({ kind: "jet" }), aircraft: plane(), helicopter: plane({ kind: "heli" }), balloon: plane({ kind: "balloon" }), rocket: plane({ kind: "rocket" }),
  // Buildings and structures.
  house: house({ windows: 2, chimney: true }), home: house({ windows: 2, chimney: true }), castle, temple, tent, barn, school, college: school, university: school, academy: school,
  bank, hospital, office: office, building: office, hotel: office, court: temple, market: shop, shop, store: shop, church, chapel: church, fort, bunker,
  wall, gate, tower, bridge, fence, well, mine, farm, mill, forge, vault, dam, door, road, street: road, path: road, highway: road,
  // Plants and food.
  tree: tree(), oak: tree({ h: 54 }), palm: tree({ kind: "palm" }), pine: tree({ kind: "pine" }), bush: tree({ kind: "bush" }), brush: tree({ kind: "bush", colour: "#8a9a5a" }), cactus: tree({ kind: "cactus" }),
  flower: flower(), rose: flower("#c9453f", 7), grass, weed: grass, mushroom,
  bread, apple, cheese, egg, meat, beef: meat, orange: s(apple.pieces, "#e8892e"), fruit: apple, cake: s([part(R(-14, -16, 14, 0), "#f2ead8"), glue(R(-15, -18, 15, -14), "#e0708f"), dot(R(-14, -9, 14, -7), "#e0708f"), glue(band([[0, -18], [0, -26]], 2), "#f4d35e"), glue(P(-2, -26, 0, -31, 2, -26), "#ec8e3e")]),
  // Dictionary themes batch 2: buildings, furniture, tools, machines, animals.
  cottage: house({ windows: 2, chimney: true, wall: "#f2ead8" }), cabin: house({ windows: 1, chimney: true, wall: "#a8703c" }), hut: house({ w: 28, h: 18, roof: "tent", windows: 0 }),
  shack: house({ w: 26, h: 18, windows: 1, wall: "#8a6440" }), mansion: house({ w: 60, h: 34, floors: 2, windows: 4, chimney: true }), palace: house({ w: 64, h: 40, roof: "dome", windows: 4, floors: 2 }),
  skyscraper: house({ w: 26, h: 70, roof: "flat", floors: 8, windows: 2, wall: "#7d9ab0" }), igloo: house({ w: 30, h: 16, roof: "dome", windows: 0, wall: "#f4f1ea" }),
  clinic: house({ w: 40, h: 24, roof: "flat", sign: "#c9453f", wall: "#f6f2ea" }), dungeon: cell, cage: cell, library: school, observatory: house({ w: 32, h: 30, roof: "dome", windows: 1, wall: "#e6e0d4" }),
  warehouse: house({ w: 60, h: 26, roof: "barn", windows: 0, wall: "#8a8f96" }), silo: house({ w: 16, h: 46, roof: "dome", windows: 0, wall: "#b8c2c8" }), cathedral: house({ w: 56, h: 48, roof: "spire", windows: 3 }),
  tavern: house({ windows: 2, sign: "#a8703c", chimney: true }), inn: house({ windows: 3, floors: 2, sign: "#a8703c", chimney: true }), pub: house({ windows: 2, sign: "#5f8a4a" }),
  workshop: house({ w: 44, h: 24, roof: "flat", sign: "#e8892e" }), smithy: forge, armory: fort, stable: barn, kennel: house({ w: 22, h: 14, windows: 0, wall: "#a8703c" }), coop: house({ w: 22, h: 16, windows: 0, wall: "#c9a77a" }),
  garage: house({ w: 44, h: 22, roof: "flat", windows: 0, door: "#7d8a99" }), greenhouse: house({ w: 44, h: 22, roof: "gable", wall: "#a8d6c8", windows: 0 }), museum: temple, pyramid: house({ w: 60, h: 40, roof: "tent", windows: 0, wall: "#e3c27a" }),
  citadel: castle, stronghold: castle, shed: house({ w: 26, h: 18, windows: 0, wall: "#8a6440" }), pavilion: tent, attic: house({ windows: 1 }), cellar: door, basement: door,
  armchair: chair, recliner: chair, sofa: bench, couch: bench, stool: chair, wardrobe: shelf, dresser: shelf, cupboard: shelf, cabinet: shelf, bookcase: shelf, hammock: bed, mattress: bed, crib: bed, bunk: bed, cradle: bed,
  lantern: lamp, candle: torch, chandelier: lamp, safe: vault, strongbox: chest, coffer: chest, trunk: chest, locker: shelf, bucket: barrel, vase: bottle, teapot: bottle, fridge: barrel, refrigerator: barrel,
  pan: s([part(E(0, -6, 12, 4, 14)), glue(band([[12, -6], [26, -10]], 2.4), "#3a3633")], "#2f2c33"), skillet: s([part(E(0, -6, 13, 4.5, 14)), glue(band([[13, -6], [28, -10]], 2.6), "#3a3633")], "#2f2c33"),
  kettle: bottle, poker: crowbar, broom: shovel, cleaver: knife, hatchet: axe, mallet: hammer, wrench: hammer, chisel: knife, drill: gun, scythe: axe, pitchfork: spear, rake: shovel, mattock: pick, trowel: shovel, hook: key, trap: chest, snare: rope, lasso: rope,
  anvil: s([part(P(-16, -18, 16, -18, 10, -12, 6, -12, 8, 0, -8, 0, -6, -12, -16, -14))], "#3a3633"), grindstone: s([part(E(0, -14, 12, 12, 16)), dot(E(0, -14, 3, 3, 8), "dark")], "#9a9590"),
  foundry: forge, kiln: forge, furnace: forge, crucible: cup, tongs: crowbar, bellows: bag,
  webcam: camera, monitor: computer, television: computer, sensor: camera, satellite: radio, telephone: phone, transmitter: radio, speaker: radio, siren: bell, floodlight: lamp, battery: s([part(R(-6, -22, 6, 0)), glue(R(-2, -25, 2, -22), "#c9d1d6"), dot(R(-6, -10, 6, -8), "#e3b341")], "#2f2c33"),
  generator: machine, motor: machine, conveyor: machine, reactor: machine, pump: machine, crane: tower, bulldozer: tank("#e3b341"), automaton: robot, drone: plane({ kind: "heli", colour: "#7d8a99" }),
  panther: jaguar, wolverine: quad({ len: 26, h: 10, leg: 5, neck: 1, head: 5.5, snout: 3, ear: "round", tail: "bushy", low: true, colour: "#4a3a2e" }), raccoon: quad({ len: 22, h: 9, leg: 5, neck: 2, head: 5, snout: 3, ear: "point", tail: "bushy", stripes: true, colour: "#7a7470" }), skunk: quad({ len: 20, h: 8, leg: 4, neck: 2, head: 4.5, snout: 3, ear: "round", tail: "bushy", stripes: true, colour: "#2f2c33" }),
  hedgehog: quad({ len: 14, h: 7, leg: 2, neck: 1, head: 4, snout: 3, ear: "none", tail: "none", low: true, wool: true, colour: "#8a6a4a" }), porcupine: quad({ len: 22, h: 10, leg: 3, neck: 1, head: 4.5, snout: 3, ear: "none", tail: "stub", low: true, wool: true, colour: "#6a5a4a" }),
  kangaroo: quad({ len: 30, h: 16, leg: 14, neck: 10, head: 5, snout: 5, ear: "point", tail: "long", colour: "#b5794a" }), koala: bear, panda: bear, hippo: quad({ len: 48, h: 18, leg: 8, legW: 6, neck: 1, head: 9, snout: 6, snoutH: 7, ear: "round", tail: "stub", colour: "#8a8590" }), hippopotamus: quad({ len: 48, h: 18, leg: 8, legW: 6, neck: 1, head: 9, snout: 6, snoutH: 7, ear: "round", tail: "stub", colour: "#8a8590" }),
  llama: camel, alpaca: sheep, pony: horse, stallion: horse, kitten: cat, hamster: rat, gerbil: rat, mink: quad({ len: 28, h: 7, leg: 4, neck: 3, head: 4.5, snout: 3, ear: "round", tail: "long", low: true, colour: "#6a4a32" }), weasel: quad({ len: 28, h: 7, leg: 4, neck: 3, head: 4.5, snout: 3, ear: "round", tail: "long", low: true, colour: "#6a4a32" }), ferret: quad({ len: 28, h: 7, leg: 4, neck: 3, head: 4.5, snout: 3, ear: "round", tail: "long", low: true, colour: "#6a4a32" }), chimpanzee: monkey, orangutan: gorilla, baboon: monkey, warthog: boar, wildebeest: bull,
  armadillo: s(turtle.pieces, "#8a8590", { living: true }), anteater: quad({ len: 40, h: 12, leg: 8, neck: 2, head: 4, snout: 12, snoutH: 2, ear: "round", tail: "bushy", colour: "#7a6a5a" }), mongoose: quad({ len: 28, h: 7, leg: 4, neck: 3, head: 4.5, snout: 3, ear: "round", tail: "long", low: true, colour: "#6a4a32" }),
  dolphin: fish({ len: 34, colour: "#8aa0b0" }), orca: fish({ shark: true, len: 44, colour: "#2f2c33" }), manatee: fish({ len: 36, colour: "#8a8590" }),
  raven: crow, pigeon: bird({ size: 0.9, colour: "#8a8f96" }), dove: bird({ size: 0.8, colour: "#f4f1ea" }), falcon: hawk, condor: vulture, swan: goose, peacock: bird({ size: 1.1, crest: true, tail: 14, colour: "#3f6fa8" }),
  quail: bird({ size: 0.7, round: true, colour: "#a8805a" }), canary: bird({ size: 0.6, colour: "#f4d35e" }), woodpecker: bird({ size: 0.8, crest: true, colour: "#c9453f" }), hummingbird: bird({ size: 0.5, colour: "#5f9a5a" }), albatross: gull,
  salmon: fish({ colour: "#e0908a" }), trout: fish({ colour: "#8a9a6a" }), tuna: fish({ len: 36, colour: "#3f5a7a" }), cod: fish({ colour: "#9a9590" }), carp: fish({ colour: "#e8892e" }), goldfish: fish({ len: 14, colour: "#e8892e" }),
  eel: snake("#3a3633"), piranha: fish({ len: 14, colour: "#c9453f" }), swordfish: fish({ shark: true, len: 40, colour: "#3f6fa8" }),
  cobra: snake("#a8805a"), python: snake("#c9a24a"), viper: snake("#8a6a4a"), rattlesnake: snake("#a8805a"), chameleon: s(lizard.pieces, "#6fae5a", { living: true }), gecko: lizard, dinosaur: crocodile,
  newt: s(lizard.pieces, "#d9773b", { living: true }), tadpole: fish({ len: 8, colour: "#3a3633" }),
  butterfly: bug({ kind: "bee", colour: "#e8892e" }), moth: bug({ kind: "bee", colour: "#9a9590" }), beetle: bug({ kind: "ant", colour: "#2f2c33" }), wasp: bug({ kind: "bee", colour: "#e3b341" }), hornet: bug({ kind: "bee", colour: "#d9773b" }),
  firefly: bug({ kind: "bee", colour: "#f4d35e" }), dragonfly: bug({ kind: "bee", colour: "#3f6fa8" }), caterpillar: snake("#6fae5a"), silkworm: snake("#f2ead8"), worm: snake("#e0908a"), snail: turtle, slug: snake("#8a7a5a"),
  octopus: bug({ kind: "spider", colour: "#c9553f" }), squid: bug({ kind: "spider", colour: "#e0908a" }), jellyfish: bug({ kind: "spider", colour: "#cfeaf2" }), lobster: crab, leech: snake("#2f2c33"), tarantula: bug({ kind: "spider", colour: "#6b4a2e" }),
  // Dictionary themes batch 3: body parts, clothing, disease, emotions, music.
  parka: s(cloak.pieces, "#c9553f"), overcoat: s(cloak.pieces, "#4a4a52"), robe: s(cloak.pieces, "#8a5a9a"), kimono: s(cloak.pieces, "#d4476a"),
  sweater: s(cloak.pieces, "#5f8a4a"), costume: s(cloak.pieces, "#e3b341"), uniform: s(cloak.pieces, "#3f5a3a"), livery: s(cloak.pieces, "#3f6fa8"), tuxedo: s(cloak.pieces, "#2f2c33"),
  camouflage: s(cloak.pieces, "#6f8a4a"), disguise: s(cloak.pieces, "#8a7a6a"), hood: s(hat.pieces, "#5a4a3a"), wig: s(hat.pieces, "#e3c27a"), balaclava: s(hat.pieces, "#2f2c33"),
  veil: s(hat.pieces, "#f4f1ea"), scarf: s(rope.pieces, "#c9453f"), mitten: s(glove.pieces, "#c9553f"), sandal: s(boot.pieces, "#a8805a"), earmuff: s(hat.pieces, "#d4476a"), earplug: s(ball.pieces, "#e8892e"),
  wing: s(cloak.pieces, "#f4f1ea"), feather: s(scroll.pieces, "#f4f1ea"), claw: s(knife.pieces, "#3a3633"), talon: s(knife.pieces, "#3a3633"), fang: s(knife.pieces, "#f3ece0"), tooth: s(knife.pieces, "#f3ece0"),
  horn: s(knife.pieces, "#c9b99a"), antler: s(knife.pieces, "#8a6a4a"), stinger: s(spear.pieces, "#2f2c33"), tentacle: s(rope.pieces, "#c9553f"), tail: s(rope.pieces, "#8a6a4a"),
  scalpel: knife, guillotine: gate, prosthesis: s(hammer.pieces, "#b8c2c8"), implant: s(computer.pieces, "#b8c2c8"),
  syringe: s(spear.pieces, "#cfeaf2"), pill: s(ball.pieces, "#f4f1ea"), antibiotic: potion, penicillin: potion, antiseptic: potion, disinfectant: s(potion.pieces, "#3f6fa8"), soap: s(box.pieces, "#f4c6d0"), bandage: s(scroll.pieces, "#f4f1ea"),
  medic: doctor, detective: spy, bloodhound: dog, hound: dog, berserk: soldier, choir: men, orchestra: men,
  drum: s(barrel.pieces, "#c9453f"), gong: s(bell.pieces, "#c9a24a"), cymbal: s(bell.pieces, "#e3b341"), tambourine: s(bell.pieces, "#a8703c"), trumpet: s(guitar.pieces, "#e3b341"), bugle: s(guitar.pieces, "#e3b341"),
  flute: s(spear.pieces, "#a8703c"), violin: guitar, fiddle: guitar, lute: guitar, banjo: guitar, harp: s(guitar.pieces, "#c9a24a"), bagpipe: s(bag.pieces, "#5f8a4a"), accordion: s(box.pieces, "#c9453f"), harmonica: s(box.pieces, "#b8c2c8"),
  megaphone: s(bell.pieces, "#e8892e"), microphone: s(torch.pieces, "#2f2c33"),
  song: rosette(icon.note(), "#3f6fa8"), music: rosette(icon.note(), "#3f6fa8"), melody: rosette(icon.note(), "#5f8a4a"), hymn: rosette(icon.note(), "#e3b341"), lullaby: rosette(icon.moon(), "#3f6fa8"), tune: rosette(icon.note(), "#5f8a4a"),
  noise: sign(icon.bolt()), silence: rosette(icon.moon(), "#7d8a99"), hush: rosette(icon.moon(), "#7d8a99"),
  plague: sign(icon.skull(), "#7a9a5a"), sickness: sign(icon.drop("#7a9a5a")), fever: sign(icon.flame()), germ: sign(icon.drop("#7a9a5a")), superbug: sign(icon.skull(), "#5a7a3a"),
  joy: rosette(icon.sun(), "#e3b341"), hope: rosette(icon.star(), "#e3b341"), despair: rosette(icon.cloud(), "#4a4a52"), rage: rosette(icon.flame(), "#c9453f"), fury: rosette(icon.flame(), "#c9453f"), wrath: rosette(icon.bolt(), "#a8323a"),
  terror: rosette(icon.skull(), "#2f2c33"), serenity: rosette(icon.wave(), "#5fa8b8"), peace: rosette(icon.leaf(), "#5f8a4a"), envy: rosette(icon.eye(), "#5f8a4a"), jealousy: rosette(icon.eye(), "#5f8a4a"), pride: rosette(icon.crown(), "#e3b341"),
  // Dictionary themes batch 4: money, crime, information, religion, weather.
  dollar: s(letter.pieces, "#5f8a4a"), fortune: s(chest.pieces, "#e3b341"), purse: s(bag.pieces, "#8a5a3a"), wallet: s(box.pieces, "#6b4a2e"),
  treasury: bank, creditor: s(thief.pieces, "#3f5a3a"), auditor: spy, gift: rosette(icon.gift(), "#c9453f"), wage: rosette(icon.coin(), "#e3b341"), tip: rosette(icon.coin(), "#e3b341"),
  donation: rosette(icon.heart(), "#e3b341"), bribe: rosette(icon.coin(), "#5f8a4a"), payoff: rosette(icon.coin(), "#5f8a4a"), debt: sign(icon.coin(), "#fbf6ea", "#a8323a"),
  loan: sign(icon.coin(), "#fbf6ea", "#3f6fa8"), mortgage: sign(icon.house(), "#fbf6ea", "#a8323a"), bankruptcy: sign(icon.hole()), foreclosure: sign(icon.key(), "#fbf6ea", "#a8323a"),
  audit: sign(icon.eye()), boom: rosette(icon.star(), "#e3b341"), crash: sign(icon.bang()),
  landmine: s(ball.pieces, "#4a5a3a"), tripwire: s(rope.pieces, "#b8c2c8"), pitfall: s(puddle.pieces, "#5a4632"), mousetrap: s(box.pieces, "#a8805a"), decoy: s(human.pieces, "#a8805a"),
  lock: s(key.pieces, "#7d7f80"), padlock: s(key.pieces, "#7d7f80"), alarm: s(bell.pieces, "#c9453f"), burglar: thief, pickpocket: thief, smuggler: pirate, swindler: thief,
  fraud: sign(icon.mask()), blackmail: sign(icon.mask(), "#fbf6ea", "#2f2c33"), extortion: sign(icon.fist()), hoax: rosette(icon.mask(), "#8a5a9a"), lie: rosette(icon.mask(), "#8a5a9a"),
  ruse: rosette(icon.mask(), "#7d8a99"), alibi: rosette(icon.key(), "#5f8a4a"), investigation: rosette(icon.eye(), "#3f6fa8"),
  jammer: s(radio.pieces, "#2f2c33"), telegraph: s(radio.pieces, "#8a6440"), tracker: sign(icon.eye(), "#fbf6ea", "#c9453f"), wanted: s(letter.pieces, "#e6c89a"), newspaper: s(book.pieces, "#f4f1ea"),
  informant: spy, espionage: sign(icon.eye(), "#fbf6ea", "#2f2c33"), gossip: rosette(icon.people(), "#d4476a"), propaganda: sign(icon.people(), "#fbf6ea", "#a8323a"),
  rumor: rosette(icon.people(), "#8a5a9a"), flare: rosette(icon.star(), "#e8892e"), static: sign(icon.bolt(), "#fbf6ea", "#7d8a99"), truth: rosette(icon.sun(), "#f4f1ea"),
  cipher: rosette(icon.key(), "#2f2c33"), encryption: rosette(icon.key(), "#3f6fa8"), news: s(book.pieces, "#f4f1ea"),
  altar: s(table.pieces, "#e6dccb"), pyre: s(pile.pieces, "#8a6440"), shrine: temple, idol: s(crown.pieces, "#e3b341"), icon: s(book.pieces, "#e3b341"), totem: s(tower.pieces, "#8a6440"),
  prophet: priest, exorcist: priest, deity: god, prayer: rosette(icon.star(), "#e3b341"), worship: rosette(icon.star(), "#e3b341"), ritual: rosette(icon.spiral(), "#8a5a9a"),
  curse: rosette(icon.skull(), "#5a3a6a"), hex: rosette(icon.spiral(), "#5a3a6a"), blessing: rosette(icon.sun(), "#e3b341"), miracle: rosette(icon.star(), "#f4d35e"), resurrection: rosette(icon.heart(), "#f4d35e"),
  heresy: sign(icon.cross(), "#fbf6ea", "#a8323a"), blasphemy: sign(icon.bang(), "#fbf6ea", "#a8323a"), atheism: sign(icon.cross(), "#fbf6ea", "#7d8a99"), exorcism: rosette(icon.cross(), "#f4f1ea"),
  frost: rosette(icon.cloud(), "#cfeaf2"), heatwave: rosette(icon.sun(), "#e0663a"), thaw: rosette(icon.drop("#5fa8b8"), "#5fa8b8"), rainbow: rosette(icon.rain(), "#d4476a"), forecast: s(letter.pieces, "#cfeaf2"),
  umbrella: s(torch.pieces, "#2f2c33"), shelter: tent,
  // Dictionary themes batch 5: time, space, sea, sports, abstract ideas.
  stasis: rosette(icon.hourglass(), "#7fc4d8"), eternity: rosette(icon.spiral(), "#e3b341"), moment: rosette(icon.clock(), "#e3b341"), instant: rosette(icon.bolt(), "#e3b341"),
  century: sign(icon.hourglass()), millennium: sign(icon.hourglass(), "#fbf6ea", "#8a6440"), decade: sign(icon.hourglass()), epoch: rosette(icon.clock(), "#8a5a9a"),
  deadline: sign(icon.clock(), "#fbf6ea", "#a8323a"), countdown: sign(icon.clock(), "#fbf6ea", "#a8323a"), pause: rosette(icon.hourglass(), "#7d8a99"), timeout: sign(icon.hourglass(), "#fbf6ea", "#7d8a99"),
  haste: rosette(icon.arrow(), "#e3b341"), acceleration: rosette(icon.arrow(), "#e8892e"), deceleration: rosette(icon.foot(), "#7d8a99"), slowness: rosette(icon.foot(), "#7d8a99"), delay: rosette(icon.hourglass(), "#7d8a99"),
  rewind: rosette(icon.spiral(), "#3f6fa8"), undo: rosette(icon.spiral(), "#3f6fa8"), rejuvenation: rosette(icon.leaf(), "#5f8a4a"), ageing: rosette(icon.hourglass(), "#8a6440"),
  hourglass: s(clock.pieces, "#e3b341"), sundial: s(table.pieces, "#9a948a"), stopwatch: s(ring.pieces, "#b8c2c8"), timer: s(box.pieces, "#c9453f"), calendar: s(letter.pieces, "#f4f1ea"),
  gravity: rosette(icon.mountain(), "#4a4a52"), gravitation: rosette(icon.mountain(), "#4a4a52"), levitation: rosette(icon.bubble(), "#cfeaf2"), weightlessness: rosette(icon.bubble(), "#cfeaf2"),
  attraction: rosette(icon.spiral(), "#c9453f"), repulsion: rosette(icon.bang(), "#3f6fa8"), magnetism: rosette(icon.spiral(), "#7d7f80"), radiation: sign(icon.bolt(), "#fbf6ea", "#e3b341"),
  bolide: rosette(icon.flame(), "#e0663a"), starlight: rosette(icon.star(), "#f4d35e"), aurora: rosette(icon.wave(), "#5fd8a8"), bombardment: sign(icon.bang(), "#fbf6ea", "#a8323a"), barrage: sign(icon.bang()),
  shower: rosette(icon.star(), "#e8892e"), singularity: rosette(icon.hole(), "#2f2c33"), supernova: rosette(icon.sun(), "#f4f1ea"), nebula: rosette(icon.cloud(), "#8a5a9a"), galaxy: rosette(icon.spiral(), "#3f3a6a"),
  pulsar: rosette(icon.bolt(), "#8a5a9a"), wormhole: rosette(icon.hole(), "#8a5a9a"), space: rosette(icon.moon(), "#2f2c33"), orbit: rosette(icon.moon(), "#7d8a99"), meteoroid: rosette(icon.flame(), "#9a948a"), cosmos: rosette(icon.star(), "#3f3a6a"),
  astrolabe: s(ring.pieces, "#e3b341"), sextant: s(ring.pieces, "#c9a24a"), anchor: s(key.pieces, "#5a5a62"), planetarium: temple, dome: s(bell.pieces, "#e6eef2"), spacesuit: s(robot.pieces, "#f4f1ea"),
  spaceship: s(plane().pieces, "#b8c2c8"), astronaut: s(robot.pieces, "#f4f1ea"), astronomer: wizard,
  sailboat: boat(), rowboat: boat({ colour: "#8a6440" }), dinghy: boat({ colour: "#e8892e" }), raft: boat({ colour: "#a8805a" }), galleon: boat({ kind: "ship", colour: "#8a6440" }),
  frigate: boat({ kind: "ship", colour: "#6b4a2e" }), warship: boat({ kind: "ship", colour: "#7d8a99" }), barge: boat({ kind: "ship", colour: "#5a5a62" }), lifeboat: boat({ colour: "#e8892e" }),
  gunboat: boat({ kind: "ship", colour: "#6b7a7a" }), shipwreck: s(pile.pieces, "#6b4a2e"), port: house({ windows: 2 }), harbor: fort, harbour: fort, marina: house({ windows: 2 }),
  dock: bridge, pier: bridge, wharf: bridge, quay: bridge, breakwater: wall, shipyard: house({ windows: 2 }),
  swell: rosette(icon.wave(), "#4d7b8c"), surf: rosette(icon.wave(), "#5fa8b8"), riptide: rosette(icon.wave(), "#3f6fa8"), whirlpool: rosette(icon.spiral(), "#3f6fa8"), maelstrom: rosette(icon.spiral(), "#2f4a7a"),
  tempest: rosette(icon.bolt(), "#2f4a7a"), doldrums: rosette(icon.sun(), "#c9b99a"), trawl: s(rope.pieces, "#7d8a99"), fishhook: s(key.pieces, "#b8c2c8"), lure: s(ball.pieces, "#c9453f"), bait: s(ball.pieces, "#8a6440"),
  oar: s(torch.pieces, "#8a6440"), broadside: sign(icon.bang()), piracy: sign(icon.skull(), "#2f2c33", "#fbf6ea"), mutiny: sign(icon.fist()), navy: rosette(icon.flag(), "#2f4a7a"), coastguard: rosette(icon.flag(), "#e8892e"),
  buccaneer: pirate, sailor: captain, admiral: captain, navigator: captain,
  duel: rosette(icon.swords(), "#c9453f"), wager: rosette(icon.coin(), "#e3b341"), bet: rosette(icon.coin(), "#e3b341"), gamble: rosette(icon.coin(), "#8a5a9a"), sparring: rosette(icon.fist(), "#c9775a"),
  forfeit: sign(icon.flag(), "#fbf6ea", "#f4f1ea"), surrender: sign(icon.flag(), "#fbf6ea", "#f4f1ea"), foul: sign(icon.bang(), "#fbf6ea", "#e3b341"), cheat: rosette(icon.mask(), "#2f2c33"),
  provocation: rosette(icon.fist(), "#c9453f"), race: rosette(icon.flag(), "#3f6fa8"), marathon: rosette(icon.foot(), "#3f6fa8"), sprint: rosette(icon.foot(), "#e8892e"), regatta: rosette(icon.wave(), "#3f6fa8"),
  bout: rosette(icon.fist(), "#c9453f"), joust: rosette(icon.swords(), "#e3b341"), tournament: rosette(icon.trophy(), "#e3b341"), game: rosette(icon.trophy(), "#5f8a4a"), sport: rosette(icon.trophy(), "#3f6fa8"),
  lottery: rosette(icon.gift(), "#e3b341"), odds: rosette(icon.coin(), "#7d8a99"), gavel: s(hammer.pieces, "#8a6440"), whistle: s(key.pieces, "#b8c2c8"), trophy: s(crown.pieces, "#e3b341"), medal: s(ring.pieces, "#e3b341"),
  dice: s(box.pieces, "#f4f1ea"), referee: s(human.pieces, "#2f2c33"), umpire: s(human.pieces, "#2f2c33"), athlete: s(human.pieces, "#c9453f"),
  peacekeeper: s(soldier.pieces, "#5fa8d8"), gladiator: knight, mediator: s(human.pieces, "#5f8a4a"), gambler: s(spy.pieces, "#5f8a4a"),
  stadium: fort, arena: fort, casino: bank, immunity: rosette(icon.cross(), "#f4f1ea"),
  chaos: rosette(icon.spiral(), "#c9453f"), entropy: rosette(icon.spiral(), "#7d8a99"), fluke: rosette(icon.star(), "#5f8a4a"), luck: rosette(icon.leaf(), "#5f8a4a"), chance: rosette(icon.coin(), "#5f8a4a"),
  randomness: rosette(icon.spiral(), "#e8892e"), order: rosette(icon.box(), "#3f6fa8"), irony: rosette(icon.mask(), "#8a5a9a"), absurdity: rosette(icon.bubble(), "#d4476a"),
  nothing: rosette(icon.hole(), "#2f2c33"), infinity: rosette(icon.spiral(), "#e3b341"), void: rosette(icon.hole(), "#1f1c23"), null: rosette(icon.hole(), "#4a4a52"), oblivion: rosette(icon.hole(), "#2f2c33"),
  existence: rosette(icon.sun(), "#f4d35e"), reality: rosette(icon.eye(), "#f4f1ea"), logic: rosette(icon.box(), "#3f6fa8"), reason: rosette(icon.book(), "#3f6fa8"), illusion: rosette(icon.mask(), "#8a5a9a"),
  certainty: rosette(icon.key(), "#3f6fa8"), fate: sign(icon.skull(), "#fbf6ea", "#2f2c33"), destiny: rosette(icon.star(), "#8a5a9a"), doom: sign(icon.skull(), "#fbf6ea", "#a8323a"),
  karma: rosette(icon.spiral(), "#5f8a4a"), providence: rosette(icon.sun(), "#e3b341"), coincidence: rosette(icon.chain(), "#8a5a9a"), paradox: rosette(icon.chain(), "#c9453f"),
  typo: sign(icon.scroll(), "#fbf6ea", "#c9453f"), mistake: sign(icon.scroll()), accident: sign(icon.bang()), dictionary: s(book.pieces, "#3f6fa8"), nonsense: rosette(icon.bubble(), "#e8892e"),
  // Expansion batch 2: siege and arms; mythic beasts and prehistoric giants.
  trebuchet: engine({ kind: "trebuchet" }), catapult: engine({ kind: "catapult" }), mangonel: engine({ kind: "catapult", colour: "#8a6440" }), onager: engine({ kind: "catapult", colour: "#9a7a50" }),
  ballista: engine({ kind: "ballista" }), springald: engine({ kind: "ballista", colour: "#8a6440" }), helepolis: engine({ kind: "tower" }), ram: engine({ kind: "ram" }), culverin: engine({ kind: "gun" }),
  arbalest: crossbow, arbalist: crossbow, crossbow, petard, portcullis, drawbridge, postern: door, sallyport: s(door.pieces, "#6b4a2e"),
  halberd: polearm("axe"), glaive: polearm("blade"), guisarme: polearm("hook"), poleaxe: polearm("hammer", 44), poleax: polearm("hammer", 44), pikestaff: polearm("spike", 62), bardiche: polearm("axe", 46),
  voulge: polearm("blade", 50), spontoon: polearm("spike", 48), billhook: s(knife.pieces, "#b8c2c8"), morningstar: polearm("ball", 30, "#7d7f80"), warhammer: polearm("hammer", 30, "#7d7f80"), mace: polearm("ball", 26, "#8e98a0"),
  falchion: sword(26, 6), scimitar: sword(28, 5, "#e6eef2"), claymore: sword(40, 5), broadsword: sword(32, 6), greatsword: sword(44, 6.5), longsword: sword(36, 4.4), backsword: sword(30, 4.6), estoc: sword(38, 3),
  misericorde: knife, poniard: knife, dirk: knife, kris: s(knife.pieces, "#c9a24a"), cudgel: club, bludgeon: s(club.pieces, "#6b4a2e"), quarterstaff: staff, assegai: spear, pilum: spear,
  slingshot: s([part(band([[0, 2], [0, -14]], 2.4), "#8a6440"), part(band([[0, -14], [-6, -26]], 2.2), "#8a6440"), part(band([[0, -14], [6, -26]], 2.2), "#8a6440"), dot(band([[-6, -26], [0, -20], [6, -26]], 0.8), "#c9553f")]),
  bola: s([...[[-8, -4], [8, -4], [0, -18]].map(([x, y]) => part(E(x!, y!, 4, 4, 10), "body"))], "#9a948a"), bolas: s([...[[-8, -4], [8, -4], [0, -18]].map(([x, y]) => part(E(x!, y!, 4, 4, 10), "body")), dot(band([[-8, -4], [0, -11], [8, -4]], 0.8), "#6b4a2e"), dot(band([[0, -11], [0, -18]], 0.8), "#6b4a2e")], "#9a948a"),
  quarrel: s([part(band([[0, 2], [0, -26]], 1.4), "body"), glue(P(-2.5, -24, 0, -32, 2.5, -24), "#8e98a0"), glue(P(-2.5, 2, 0, -3, 2.5, 2), "#c9553f")], "#8a6440"),
  arquebus: longGun(), harquebus: longGun(), hackbut: longGun("#7a5a3a"), hagbut: longGun("#7a5a3a"), matchlock: longGun("#6b4a2e"), musket: longGun(), blunderbuss: longGun("#8a6440", true),
  carbine: s(rifle.pieces, "#5a5a62"), fusil: longGun("#9a7a50"), grapeshot: s([...[[-6, -3], [0, -3], [6, -3], [-3, -8], [3, -8], [0, -13]].map(([x, y]) => part(E(x!, y!, 3.2, 3.2, 10), "body"))], "#4a4a52"),
  hauberk: plateArmour("#b8c2c8", true), habergeon: plateArmour("#c9d1d6", true), chainmail: plateArmour("#b8c2c8", true), cuirass: plateArmour("#d8e0e4"), brigandine: plateArmour("#a8323a"),
  gambeson: plateArmour("#efe4cf"), lamellar: plateArmour("#8e98a0", true), caparison: plateArmour("#c9553f"), pauldron: s(armor.pieces, "#c9d1d6"),
  greave: s(boot.pieces, "#b8c2c8"), sabaton: s(boot.pieces, "#c9d1d6"), vambrace: s(glove.pieces, "#b8c2c8"), rerebrace: s(glove.pieces, "#c9d1d6"), gorget: collar, aventail: collar, camail: collar,
  armet: s(helmet.pieces, "#c9d1d6"), heaume: s(helmet.pieces, "#8e98a0"), sallet: s(helmet.pieces, "#d8e0e4"), basinet: s(helmet.pieces, "#b8c2c8"), morion: s(helmet.pieces, "#e6eef2"), chanfron: s(helmet.pieces, "#b8c2c8"),
  buckler: roundShield, targe: s(roundShield.pieces, "#6b4a2e"), pavise: tallShield, escutcheon: s(shield.pieces, "#3f6fa8"),
  mantlet: s([part(R(-16, -40, 16, -6), "body", 1), ...[-10, -3, 4, 11].map((x) => dot(band([[x, -38], [x, -8]], 0.8), "dark")), dot(R(-4, -30, 4, -27), "#2e2a26"), ...wheel(-10, -5, 5), ...wheel(10, -5, 5)], "#a8703c"),
  surcoat: s(cloak.pieces, "#c9553f"), tabard: s(cloak.pieces, "#3f6fa8"),
  machicolation: machicolations, crenellation: merlons(), crenelation: merlons(), merlon: merlons("#c9bca4"), embrasure: merlons("#bfb3a0", true), loophole: merlons("#b5a890", true), arrowslit: merlons("#c9bca4", true),
  bailey: fort, outwork: s(wall.pieces, "#a8916a"), revetment: wall, ravelin: fort, glacis: s(wall.pieces, "#a8916a"), casemate: bunker, blockhouse: house({ roof: "flat", wall: "#a8703c", roofInk: "#6b4a2e", windows: 2 }),
  bartizan: tower, escarp: wall, motte: sign(icon.mountain()),
  crossbowman: soldierOf("#6b7a4a", "none"), arbalester: soldierOf("#5a6a4a", "none"), pikeman: soldierOf("#7a4a3a"), arquebusier: soldierOf("#4a5a7a", "staff", "cap"), castellan: s(king.pieces, "#5a4a8a"),
  besieger: soldierOf("#7a5a3a", "none"), yeoman: soldierOf("#5f8a4a", "none", "cap"), horseman: knight, fusilier: soldierOf("#a83a3a", "staff", "cap"), skirmisher: soldierOf("#8a7a5a", "spear", "hood"),
  condottiere: soldierOf("#3d3a40"), landsknecht: soldierOf("#c9553f", "none", "cap"), cavalier: s(knight.pieces, "#3f6fa8"),
  armorer: smith, armourer: smith, bowyer: s(smith.pieces, "#5f8a4a"), fletcher: s(smith.pieces, "#8a6440"), swordsmith: s(smith.pieces, "#4a4a52"),
  breach: sign(icon.bang(), "#fbf6ea", "#c9553f"), escalade: sign(icon.arrow("#8a6440")), countermine: sign(icon.hole()), undermining: sign(icon.hole()), sortie: rosette(icon.swords(), "#c9553f"), sally: rosette(icon.swords(), "#e8892e"),
  circumvallation: rosette(icon.chain(), "#7d8a99"),
  manticore: stinger(winged(lionBody("#c9553f"), 10, -30, 1, false), -22, -24), gryphon: winged(withBeak(lionBody("#d9a65a"), 32, -36), 8, -30), griffon: winged(withBeak(lionBody("#c9955a"), 32, -36), 8, -30),
  griffin: winged(withBeak(lionBody("#d9a65a"), 32, -36), 8, -30), hippogriff: winged(withBeak(horseBody("#efe9dc"), 30, -48), 10, -36), pegasus: winged(horseBody("#f4f1ea"), 10, -36), alicorn: winged(withHorn(horseBody("#f4f1ea"), 30, -54), 10, -36),
  unicorn: withHorn(horseBody("#f4f1ea"), 30, -54), kelpie: s(horseBody("#2f2c33").pieces, "#2f2c33", { living: true }), kelpy: s(horseBody("#2f3a44").pieces, "#2f3a44", { living: true }), pooka: s(smallHorse("#2b2a28").pieces, "#2b2a28", { living: true }),
  qilin: withHorn(deerBody("#e3b341"), 26, -44, "#c9553f"), kirin: withHorn(deerBody("#e3b341"), 26, -44, "#c9553f"), peryton: winged(deerBody("#5f8a4a"), 6, -30),
  cockatrice: winged(s([...chicken.pieces, part(band([[-12, -14], [-22, -10], [-28, -16], [-34, -12]], 3, 1), "#5f8a4a")], "#e3b341", { living: true }), 2, -18, 0.6, false),
  amphisbaena: twoHeaded(snake("#5f8a4a")), cerberus: multiHead(quad({ len: 40, h: 13, leg: 13, neck: 6, head: 6.5, snout: 6, ear: "point", tail: "thin", colour: "#2f2c33" }), 26, -32, 5),
  chupacabra: quad({ len: 30, h: 10, leg: 11, neck: 4, head: 5.5, snout: 5, ear: "point", tail: "thin", stripes: true, colour: "#7d8a8a" }),
  kitsune: s([...fox.pieces, ...[-0.3, 0.2].map((d) => part(P(-13, -16, -26, -26 + d * 20, -34, -14 + d * 16, -28, -10, -14, -12), "body", 2))], "#e8892e", { living: true }),
  smilodon: sabre, megatherium: bigSloth, megathere: bigSloth, mylodon: s(bigSloth.pieces, "#a8865a", { living: true }), glyptodont: domeBack,
  aurochs: s(bull.pieces, "#2f2c33", { living: true }), megaloceros: quad({ len: 42, h: 14, leg: 20, neck: 12, head: 6, snout: 6, ear: "point", tail: "stub", horns: "antler", colour: "#8a5a3a" }),
  elasmotherium: woolly(rhino, "#7a5a3a"), indricothere: quad({ len: 50, h: 18, leg: 28, legW: 6, neck: 18, head: 7, snout: 6, snoutH: 5, ear: "round", tail: "thin", colour: "#8e8b86" }),
  uintathere: s(rhino.pieces, "#6b6560", { living: true }), dinocerate: s(rhino.pieces, "#7a7268", { living: true }), gomphothere: elephantKin("#8a8478"), mastodont: woolly(elephantKin("#7a5a3a"), "#7a5a3a"),
  eohippus: smallHorse("#8a5a3a"), mesohippus: smallHorse("#9a6a4a"), protohippus: smallHorse("#a8786a"),
  tyrannosaur: dino({ kind: "theropod", colour: "#5f7a3a" }), tyrannosaurus: dino({ kind: "theropod", colour: "#5f7a3a" }), allosaur: dino({ kind: "theropod", colour: "#8a6a4a" }), allosaurus: dino({ kind: "theropod", colour: "#8a6a4a" }),
  carnosaur: dino({ kind: "theropod", colour: "#7a5a3a" }), megalosaur: dino({ kind: "theropod", colour: "#8a7a4a" }), megalosaurus: dino({ kind: "theropod", colour: "#8a7a4a" }), ceratosaur: dino({ kind: "theropod", colour: "#a8603a" }),
  ceratosaurus: dino({ kind: "theropod", colour: "#a8603a" }), herrerasaurus: dino({ kind: "theropod", size: 0.7, colour: "#8a6a4a" }),
  spinosaurus: dino({ kind: "sail", colour: "#a8603a" }), dimetrodon: dino({ kind: "sail", size: 0.6, colour: "#c9773a" }), pelycosaur: dino({ kind: "sail", size: 0.55, colour: "#c9773a" }),
  velociraptor: dino({ kind: "raptor", size: 0.6, colour: "#8a6a4a" }), utahraptor: dino({ kind: "raptor", size: 0.85, colour: "#8a6a4a" }), deinonychus: dino({ kind: "raptor", size: 0.7, colour: "#6b5a44" }),
  dromaeosaur: dino({ kind: "raptor", size: 0.6, colour: "#7a6a4a" }), maniraptor: dino({ kind: "raptor", size: 0.55, colour: "#6b6a4a" }), compsognathus: dino({ kind: "raptor", size: 0.35, colour: "#6f9a50" }),
  eoraptor: dino({ kind: "raptor", size: 0.4, colour: "#8a6a4a" }), staurikosaurus: dino({ kind: "raptor", size: 0.45, colour: "#8a6a4a" }), oviraptorid: dino({ kind: "raptor", size: 0.5, colour: "#c9773a" }),
  apatosaurus: dino({ kind: "sauropod", colour: "#7f9a5a" }), apatosaur: dino({ kind: "sauropod", colour: "#7f9a5a" }), brontosaur: dino({ kind: "sauropod", colour: "#8e8b86" }), brontosaurus: dino({ kind: "sauropod", colour: "#8e8b86" }),
  diplodocus: dino({ kind: "sauropod", colour: "#9a9a7a" }), barosaurus: dino({ kind: "sauropod", colour: "#9a948a" }), seismosaur: dino({ kind: "sauropod", size: 1.2, colour: "#8a8478" }), titanosaur: dino({ kind: "sauropod", size: 1.3, colour: "#7d7f80" }),
  argentinosaur: dino({ kind: "sauropod", size: 1.35, colour: "#8a7a6a" }), sauropod: dino({ kind: "sauropod", colour: "#8e8b86" }),
  stegosaur: dino({ kind: "stego", colour: "#6f8a4a" }), stegosaurus: dino({ kind: "stego", colour: "#6f8a4a" }), ankylosaur: dino({ kind: "ankylo", colour: "#8a6a4a" }), ankylosaurus: dino({ kind: "ankylo", colour: "#8a6a4a" }),
  triceratops: dino({ kind: "ceratops", colour: "#8a7a5a" }), styracosaurus: dino({ kind: "ceratops", colour: "#9a6a4a" }), ceratopsian: dino({ kind: "ceratops", colour: "#8a7a5a" }), protoceratops: dino({ kind: "ceratops", size: 0.6, colour: "#a8865a" }),
  psittacosaurus: dino({ kind: "duckbill", size: 0.45, colour: "#6f9a50" }), pachycephalosaurus: dino({ kind: "dome", size: 0.7, colour: "#8a6a4a" }), hadrosaur: dino({ kind: "duckbill", colour: "#6f9a50" }),
  hadrosaurus: dino({ kind: "duckbill", colour: "#6f9a50" }), corythosaurus: dino({ kind: "duckbill", colour: "#5f8a6a" }), edmontosaurus: dino({ kind: "duckbill", colour: "#7f9a5a" }), trachodon: dino({ kind: "duckbill", colour: "#6f8a5a" }),
  anatotitan: dino({ kind: "duckbill", size: 1.1, colour: "#7f8a5a" }), iguanodon: dino({ kind: "duckbill", colour: "#6f8a4a" }),
  pteranodon: dino({ kind: "ptero", colour: "#a8603a" }), pterodactyl: dino({ kind: "ptero", colour: "#8a6a4a" }), pterosaur: dino({ kind: "ptero", colour: "#8a6a4a" }),
  plesiosaurus: dino({ kind: "plesio", colour: "#3f7a8a" }), plesiosaur: dino({ kind: "plesio", colour: "#3f7a8a" }), ichthyosaurus: fish({ len: 34, shark: true, colour: "#4d6b8a" }), ichthyosaur: fish({ len: 34, shark: true, colour: "#4d6b8a" }),
  mosasaur: fish({ len: 44, shark: true, colour: "#3f6a6a" }), nothosaur: dino({ kind: "plesio", size: 0.6, colour: "#3f7a6a" }), megalodon: fish({ len: 48, shark: true, colour: "#6a7a86" }),
  dicynodont: quad({ len: 30, h: 12, leg: 6, legW: 4, neck: 1, head: 6, snout: 3, ear: "none", tail: "stub", tusk: true, low: true, colour: "#8a6a4a" }), cynodont: rat, thecodont: lizard, archosaur: lizard, saurian: s(lizard.pieces, "#5f8a4a", { living: true }),
  labyrinthodont: s(crocodile.pieces, "#7a6a4a", { living: true }), eurypterid: s(scorpion.pieces, "#8a6a4a", { living: true, speck: false }), belemnite: s(fish({ len: 20, colour: "#8a6a5a" }).pieces, "#8a6a5a", { living: true }),
  crinoid: flower("#d98aa0", 10, 22), archaeornis: bird({ size: 0.8, beak: 3, flies: true, colour: "#6b5a44" }),
  eaglet: bird({ size: 0.8, beak: 3, hooked: true, round: true, colour: "#a8865a", breast: "#e6d3a3" }), owlet: bird({ size: 0.8, beak: 2, hooked: true, round: true, tail: 1, colour: "#c9b99a", breast: "#efe4cf" }),
  cygnet: bird({ size: 0.9, beak: 4, neck: 4, legs: 3, colour: "#9a9a9e" }), hatchling: s([...egg.pieces.map((p) => ({ ...p, pts: p.pts.filter(([, y]) => y > -8) })), ...moved(dino({ kind: "theropod", colour: "#6f9a50" }), 2, -4, 0.3).pieces], "#6f9a50", { living: true }),
  dragonet: moved(dragon("#d9573b"), 0, 0, 0.45), firedrake: dragon("#e8892e"), wivern: dragon("#5f7a3a"), wyvern: dragon("#5f7a3a"),
  wyrm: s(snake("#a8323a").pieces.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * 1.8, y * 1.8] as Pt) })), "#a8323a", { living: true }), lindworm: s(snake("#5f7a3a").pieces.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * 1.5, y * 1.5] as Pt) })), "#5f7a3a", { living: true }),
  scylla: many(snake("#3f7a6a"), [[-6, -6, 0.9], [4, 0, 1], [-14, 2, 0.8]]), tarasque: s([...turtle.pieces.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * 2.2, y * 2.2] as Pt) })), ...[-16, -6, 4, 14].map((x) => glue(P(x - 3, -18, x, -28, x + 3, -18), "#efe6d0"))], "#5f7a3a", { living: true }),
  bahamut: s(whale.pieces, "#3f6fa8", { living: true }), catoblepas: s(bull.pieces, "#6b6560", { living: true }), bunyip: s(seal.pieces, "#6b4a32", { living: true }), selkie: s(seal.pieces, "#8a8a92", { living: true }),
  simurgh: bird({ size: 1.8, beak: 4, hooked: true, flies: true, tail: 12, crest: true, colour: "#3f8a8a", breast: "#e3b341" }), garuda: bird({ size: 1.8, beak: 4, hooked: true, flies: true, tail: 6, crest: true, colour: "#e8892e", breast: "#c9553f" }),
  ziz: bird({ size: 2.2, beak: 5, hooked: true, flies: true, tail: 8, colour: "#6b4a2e", breast: "#c9a77a" }),
  minotaur: biped({ h: 50, w: 12, hat: "horns", skin: "#7a4a2e", colour: "#5a3a2a", legs: "#3d2a1e", belt: "#c9a24a" }), gorgon: biped({ hat: "none", skin: "#9ab88a", colour: "#5f7a4a", beard: undefined, robe: true }),
  lamia: serpentFolk("#5f8a4a", "#e9c9a8"), naga: serpentFolk("#3f7a5a", "#c9a07a"), merman: merfolk("#3f8a8a", "#d9b896"), nixie: merfolk("#5fa8b8", "#cfe3ea", "#5fa8b8"), undine: merfolk("#7fc4d8", "#cfe3ea", "#4d7b8c"),
  naiad: merfolk("#5f8a6a", "#e9d8c8", "#4d8a7a"), nereid: merfolk("#3f8a9a", "#f3e6d8", "#3f6f8a"),
  dryad: biped({ robe: true, hat: "hair", hair: "#5f8a4a", skin: "#c9b08a", colour: "#6f9a50" }), hamadryad: biped({ robe: true, hat: "hair", hair: "#4f7a4a", skin: "#a8906a", colour: "#5f7a3a" }), treant: treeFolk,
  hobgoblin: biped({ h: 32, skin: "#7f9a5a", hat: "none", colour: "#6b4a32", legs: "#4a3a2a" }), bugbear: biped({ h: 48, w: 12, skin: "#8a6a4a", hat: "none", colour: "#6b4a32", legs: "body" }),
  ogress: biped({ h: 56, w: 13, skin: "#8aa06a", hat: "bun", hair: "#3d2a1e", colour: "#6b5a44", robe: true }), giantess: biped({ h: 72, w: 13, hat: "bun", hair: "#8a6440", colour: "#a8603a", robe: true }),
  ettin: s([...biped({ h: 64, w: 14, beard: "#5a3a24", colour: "#7a6a4a" }).pieces, part(E(-12, -50, 7, 7.5, 14), "#efcfae"), eye(-9, -51, 1.4), dot(P(-18, -50, -14, -58, -6, -57, -8, -52), "#5a3a24")], "#7a6a4a", { living: true }), kobold: biped({ h: 22, skin: "#c9553f", hat: "none", tail: true, colour: "#6b4a32" }),
  redcap: biped({ h: 26, hat: "cap", skin: "#d9b896", colour: "#5a4a3a", beard: "#8e8580" }), boggart: biped({ h: 24, skin: "#8a7a5a", hat: "none", colour: "#5a4a3a" }), homunculus: biped({ h: 14, head: 7, hat: "none", skin: "#e9b8b0", colour: "#e9b8b0" }),
  lycanthrope: biped({ h: 46, w: 11, skin: "#8a939e", hat: "horns", tail: true, colour: "#6a6e78", legs: "body" }), wolfman: biped({ h: 46, w: 11, skin: "#8a7a6a", hat: "horns", tail: true, colour: "#6b5a4a", legs: "body" }),
  sasquatch: s(gorilla.pieces, "#6b4a32", { living: true }), bigfoot: s(gorilla.pieces, "#7a5a3a", { living: true }), yowie: s(gorilla.pieces, "#8a6a4a", { living: true }),
  wendigo: biped({ h: 60, w: 8, skin: "#e9e6dc", hat: "horns", colour: "#d8d2c4", legs: "body", arms: "forward" }), rakshasa: biped({ h: 48, w: 11, skin: "#e08a3e", hat: "horns", colour: "#7a2a3a", robe: true }),
  tengu: biped({ skin: "#c9453f", hat: "cap", wings: "feather", colour: "#4a4a52", held: "staff" }), silenus: biped({ robe: true, beard: "#e9e2d0", hair: "#e9e2d0", colour: "#8a5ac9" }),
  lich: biped({ robe: true, hat: "crown", skin: "#e9e2d0", held: "staff", colour: "#4a2a5a" }), typhon: s(giant.pieces, "#a8323a", { living: true }),
  jinn: spirit("#5fa8d8"), jinni: spirit("#5fa8d8"), djinni: spirit("#4d8ac9"), ifrit: spirit("#d9573b", "horns"), efreet: spirit("#c9453f", "horns"), dybbuk: spirit("#9a9aa0"), sylph: s(spirit("#e9eef0").pieces, "#e9eef0", { living: true, flies: true }),
  charybdis: rosette(icon.spiral(), "#2f4a7a"), extinction: sign(icon.skull(), "#fbf6ea", "#c9553f"),
  slayer: s(knight.pieces, "#7a2a2a"), dragonslayer: s(knight.pieces, "#a8323a"), paleontologist: s(digger.pieces, "#c9a77a"),
  wolfsbane: flower("#8a5ac9", 5, 18), phylactery: s(ring.pieces, "#c9d1d6"), chick: bird({ size: 0.6, beak: 2, round: true, tail: 1, colour: "#f4d35e" }), termite: bug({ kind: "ant", colour: "#efe2c4" }),
  // Dictionary themes batch 6: bugs, grubs and swarms; stone and ore.
  maggot: bug({ kind: "worm", colour: "#f2ead8" }), larva: bug({ kind: "worm", colour: "#f2ead8" }), grub: bug({ kind: "worm", colour: "#efe2c4" }), pupa: s(cocoon.pieces, "#a8805a"), chrysalis: s(cocoon.pieces, "#6fae5a"),
  clegg: bug({ kind: "fly" }), cleg: bug({ kind: "fly" }), horsefly: bug({ kind: "fly" }), housefly: bug({ kind: "fly" }), blowfly: bug({ kind: "fly" }), greenbottle: bug({ kind: "fly" }),
  botfly: bug({ kind: "fly" }), sandfly: bug({ kind: "fly" }), blackfly: bug({ kind: "fly" }), whitefly: bug({ kind: "fly" }), greenfly: bug({ kind: "fly" }), medfly: bug({ kind: "fly" }),
  drosophila: bug({ kind: "fly" }), gallfly: bug({ kind: "fly" }), sawfly: bug({ kind: "fly" }), stonefly: bug({ kind: "fly" }), alderfly: bug({ kind: "fly" }), dobsonfly: bug({ kind: "fly" }),
  snakefly: bug({ kind: "fly" }), shadfly: bug({ kind: "fly" }), dayfly: bug({ kind: "fly" }), sciara: bug({ kind: "fly" }), glossina: bug({ kind: "fly" }), tzetze: bug({ kind: "fly" }),
  punky: bug({ kind: "fly" }), punkie: bug({ kind: "fly" }), anopheline: bug({ kind: "fly" }), dipteran: bug({ kind: "fly" }), dipteron: bug({ kind: "fly" }), damselfly: bug({ kind: "fly" }),
  chalcid: bug({ kind: "fly" }), lacewing: bug({ kind: "fly" }), goldeneye: bug({ kind: "fly" }), comma: bug({ kind: "moth" }), underwing: bug({ kind: "moth" }), hawkmoth: bug({ kind: "moth" }),
  eggar: bug({ kind: "moth" }), egger: bug({ kind: "moth" }), cecropia: bug({ kind: "moth" }), hairstreak: bug({ kind: "moth" }), silverspot: bug({ kind: "moth" }), anglewing: bug({ kind: "moth" }),
  tortrix: bug({ kind: "moth" }), noctuid: bug({ kind: "moth" }), geometrid: bug({ kind: "moth" }), browntail: bug({ kind: "moth" }), lepidopteran: bug({ kind: "moth" }), lepidopteron: bug({ kind: "moth" }),
  tussah: bug({ kind: "moth" }), tussore: bug({ kind: "moth" }), cockchafer: bug({ kind: "beetle" }), deathwatch: bug({ kind: "beetle" }), longicorn: bug({ kind: "beetle" }), ladybeetle: bug({ kind: "beetle" }),
  blackbeetle: bug({ kind: "beetle" }), dorbeetle: bug({ kind: "beetle" }), tumblebug: bug({ kind: "beetle" }), scarabaeus: bug({ kind: "beetle" }), calosoma: bug({ kind: "beetle" }), elater: bug({ kind: "beetle" }),
  figeater: bug({ kind: "beetle" }), vedalia: bug({ kind: "beetle" }), capsid: bug({ kind: "beetle" }), chinch: bug({ kind: "beetle" }), mealybug: bug({ kind: "beetle" }), psyllid: bug({ kind: "beetle" }),
  psylla: bug({ kind: "beetle" }), thrips: bug({ kind: "beetle" }), thrip: bug({ kind: "beetle" }), adelgid: bug({ kind: "beetle" }), conenose: bug({ kind: "beetle" }), redbug: bug({ kind: "beetle" }),
  chigger: bug({ kind: "beetle" }), chigoe: bug({ kind: "beetle" }), cootie: bug({ kind: "beetle" }), crotonbug: bug({ kind: "beetle" }), woodlouse: bug({ kind: "beetle" }), slater: bug({ kind: "beetle" }),
  isopod: bug({ kind: "beetle" }), leafhopper: bug({ kind: "cricket" }), planthopper: bug({ kind: "cricket" }), froghopper: bug({ kind: "cricket" }), spittlebug: bug({ kind: "cricket" }), treehopper: bug({ kind: "cricket" }),
  backswimmer: bug({ kind: "cricket" }), katydid: bug({ kind: "cricket" }), cicala: bug({ kind: "cricket" }), springtail: bug({ kind: "cricket" }), bristletail: bug({ kind: "cricket" }), firebrat: bug({ kind: "cricket" }),
  booklouse: bug({ kind: "cricket" }), amphipod: bug({ kind: "cricket" }), sandhopper: bug({ kind: "cricket" }), copepod: bug({ kind: "cricket" }), daphnia: bug({ kind: "cricket" }), ostracod: bug({ kind: "cricket" }),
  cutworm: bug({ kind: "worm" }), armyworm: bug({ kind: "worm" }), bollworm: bug({ kind: "worm" }), webworm: bug({ kind: "worm" }), cankerworm: bug({ kind: "worm" }), cabbageworm: bug({ kind: "worm" }),
  inchworm: bug({ kind: "worm" }), looper: bug({ kind: "worm" }), mealworm: bug({ kind: "worm" }), wireworm: bug({ kind: "worm" }), caddisworm: bug({ kind: "worm" }), nematode: bug({ kind: "worm" }),
  roundworm: bug({ kind: "worm" }), threadworm: bug({ kind: "worm" }), pinworm: bug({ kind: "worm" }), eelworm: bug({ kind: "worm" }), helminth: bug({ kind: "worm" }), trematode: bug({ kind: "worm" }),
  schistosome: bug({ kind: "worm" }), cestode: bug({ kind: "worm" }), echinococcus: bug({ kind: "worm" }), trichina: bug({ kind: "worm" }), planarian: bug({ kind: "worm" }), planaria: bug({ kind: "worm" }),
  tardigrade: bug({ kind: "worm" }), lugworm: bug({ kind: "worm" }), lobworm: bug({ kind: "worm" }), angleworm: bug({ kind: "worm" }), fishworm: bug({ kind: "worm" }), nightwalker: bug({ kind: "worm" }),
  bloodworm: bug({ kind: "worm" }), polychaete: bug({ kind: "worm" }), polychete: bug({ kind: "worm" }), annelid: bug({ kind: "worm" }), oligochaete: bug({ kind: "worm" }), arrowworm: bug({ kind: "worm" }),
  woodworm: bug({ kind: "worm" }), shipworm: bug({ kind: "worm" }), teredo: bug({ kind: "worm" }), glowworm: bug({ kind: "worm" }), cercaria: bug({ kind: "worm" }), bloodsucker: bug({ kind: "worm" }),
  mantid: bug({ kind: "mantis" }), phasmid: bug({ kind: "mantis" }), walkingstick: bug({ kind: "mantis" }), millipede: bug({ kind: "centipede" }), millepede: bug({ kind: "centipede" }), milliped: bug({ kind: "centipede" }),
  myriapod: bug({ kind: "centipede" }), pseudoscorpion: bug({ kind: "spider" }), harvestman: bug({ kind: "spider" }), vinegarroon: bug({ kind: "spider" }), arachnid: bug({ kind: "spider" }), acarus: bug({ kind: "spider" }),
  antlion: bug({ kind: "spider" }), andrena: bug({ kind: "bee" }), humblebee: bug({ kind: "bee" }), pismire: bug({ kind: "ant" }), emmet: bug({ kind: "ant" }), cocoon: cocoon,
  anthill: mound, formicary: mound, honeycomb: comb, beeswax: s(ingot.pieces, "#e9c46a"), insecticide: spray, larvicide: spray,
  mothball: s(ball.pieces, "#f4f1ea"), flypaper: s(letter.pieces, "#f4d35e"), swatter: swatter, flyswatter: swatter, entomologist: s(human.pieces, "#6f8a5a"), exterminator: s(human.pieces, "#c9a24a"),
  apiarist: s(human.pieces, "#f4e9c8"), bookworm: s(human.pieces, "#8a5a9a"), vivarium: s(box.pieces, "#bfe0e6"), ovipositor: s(knife.pieces, "#6b4a2e"), anthracite: s(pile.pieces, "#2f2c33"), lignite: s(pile.pieces, "#5a4632"),
  aquamarine: gemCut, lazuli: gemCut, morganite: gemCut, chrysoprase: gemCut, cabochon: gemCut, carbonado: gemCut,
  chert: rocky, dolomite: rocky, brownstone: rocky, bluestone: rocky, quartzite: rocky, porphyry: cluster,
  gneiss: rocky, schist: rocky, andesite: rocky, siltstone: rocky, rhyolite: rocky, breccia: rocky,
  tufa: rocky, fieldstone: rocky, diorite: rocky, gabbro: rocky, dacite: rocky, peridotite: rocky,
  pegmatite: rocky, amphibolite: rocky, argillite: rocky, claystone: rocky, gritstone: rocky, greisen: rocky,
  hornfels: rocky, kimberlite: rocky, greensand: s(pile.pieces), glauconite: rocky, holystone: rocky, aa: rocky,
  pahoehoe: rocky, gesso: rocky, calcite: cluster, aragonite: rocky, feldspar: rocky, orthoclase: rocky,
  plagioclase: rocky, albite: rocky, anorthite: rocky, nepheline: rocky, muscovite: sheet, biotite: sheet,
  phlogopite: sheet, lepidolite: sheet, isinglass: sheet, olivine: cluster, pyroxene: rocky, augite: rocky,
  amphibole: rocky, hornblende: rocky, kyanite: rocky, cordierite: rocky, wollastonite: rocky, vesuvian: rocky,
  zeolite: rocky, apatite: rocky, fluorapatite: rocky, chlorite: rocky, cristobalite: rocky, celestite: cluster,
  barite: rocky, barytes: rocky, fluorite: cluster, fluor: cluster, fluorspar: cluster, corundum: rocky,
  spodumene: rocky, magnesite: rocky, pyrrhotite: rocky, pyrophyllite: rocky, talc: s(pile.pieces), talcum: s(pile.pieces),
  sepiolite: rocky, meerschaum: cluster, kaolinite: oreLump, halite: rocky, carnallite: rocky, cryolite: cluster,
  borax: rocky, alumina: rocky, magnesia: rocky, vermiculite: rocky, chrysotile: rocky, tremolite: rocky,
  actinolite: rocky, realgar: rocky, orpiment: rocky, ochre: s(pile.pieces), umber: s(pile.pieces), ruddle: s(pile.pieces),
  raddle: s(pile.pieces), goldstone: cluster, rhinestone: cluster, monazite: rocky, xenotime: rocky, coltan: rocky,
  molybdenite: rocky, carbuncle: gemCut, carnelian: gemCut, cornelian: gemCut, chalcedony: gemCut, sunstone: gemCut,
  alexandrite: gemCut, sard: gemCut, sardonyx: gemCut, aventurine: gemCut, chrysoberyl: gemCut, chrysolite: gemCut,
  pyrope: gemCut, almandine: gemCut, jacinth: gemCut, kunzite: gemCut, girasol: gemCut, heliotrope: gemCut,
  jadeite: gemCut, nephrite: gemCut, cairngorm: gemCut, balas: gemCut, spinel: gemCut, rhodonite: gemCut,
  rhodochrosite: gemCut, sodalite: gemCut, azurite: oreLump, haematite: oreLump, siderite: oreLump, limonite: oreLump,
  goethite: oreLump, taconite: oreLump, chalcopyrite: oreLump, bornite: oreLump, chalcocite: oreLump, cerussite: oreLump,
  cassiterite: oreLump, sphalerite: oreLump, blende: oreLump, calamine: oreLump, wurtzite: oreLump, ilmenite: oreLump,
  rutile: oreLump, chromite: oreLump, wolframite: oreLump, scheelite: oreLump, stibnite: oreLump, gibbsite: oreLump,
  arsenopyrite: oreLump, tantalite: oreLump, columbite: oreLump, pitchblende: oreLump, uraninite: oreLump, carnotite: oreLump,
  batholith: rocky, pluton: rocky, boulder: s(rock.pieces.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * 2.2, y * 2.2] as Pt) }))), pebble: pebbles, outcrop: rocky, bedrock: s(brickWall(64, 2, "#7d7f80").pieces),
  cobble: s(rock.pieces.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * 0.6, y * 0.6] as Pt) }))), geode: geodeShape, stalagmite: stalagmiteShape, quicksand: s(puddle.pieces, "#d9c08a", { flat: true }), pitman: digger, mineralogist: wizard,
  assayer: s(human.pieces, "#8a6440"), spelunker: s(digger.pieces, "#c9773a"), gelignite: s([part(R(-4, -22, 4, 0), "body", 1), dot(R(-4, -16, 4, -12), "#f4f1ea"), glue(band([[0, -22], [3, -28], [6, -28]], 0.9), "#c9a77a"), glue(P(5, -32, 8, -28, 5, -26, 8, -25, 4, -24), "#f4c95d")], "#c9453f"), detonator: s(box.pieces, "#c9453f"), seismograph: s(machine.pieces, "#7d8a99"), crust: rocky, cinder: s(pile.pieces, "#3a3633"),
  // Theme 30: traps and dungeons.
  mantrap: jaws(), flytrap: s(letter.pieces, "#f4d35e", { flat: true }), rattrap: s(box.pieces, "#a8805a"), minefield: mines, abatis: abatisShape, barbwire: wire(),
  fetter: cuffs(), hobble: cuffs("#7a4a2e"), crusher: crusherShape, chute: trapdoor, leash: s(rope.pieces, "#7a4a2e"), lariat: s(rope.pieces, "#c9a77a"),
  garrote: garroteShape, garrotte: garroteShape, scourge: scourgeShape, blowgun: blowgunShape, thumbscrew: screwClamp, muzzle: muzzleShape, blindfold: blindfoldShape,
  straitjacket: straitjacketShape, gibbet: gibbetShape, quicklime: s(pile.pieces, "#f4f1ea"),
  panopticon: house({ w: 46, h: 36, roof: "dome", wall: "#9a948a", roofInk: "#6b6660", windows: 4, floors: 2 }), chokey: lockup(), choky: lockup(), bullpen: lockup("#8e8b80", 46, 24),
  hoosegow: lockup("#a8805a"), pokey: lockup("#8e8b80", 36, 26), slammer: lockup("#7d7f80", 46, 32),
  lazaretto: house({ w: 44, h: 26, roof: "gable", wall: "#f4f1ea", roofInk: "#5f8a8a", windows: 3 }), reformatory: house({ w: 46, h: 30, roof: "flat", wall: "#b0553f", windows: 4, floors: 2 }), borstal: house({ w: 46, h: 30, roof: "flat", wall: "#9a4a3a", windows: 4, floors: 2 }),
  breastwork: earthwork(), fieldwork: earthwork("#9a8660"), retrenchment: earthwork("#8d877c"), lunette: earthwork("#8a7656", true), foxhole: foxholeShape, crenel: merlons("#c9bca4"),
  entrenchment: s(foxholeShape.pieces, "#7a6646", { flat: true }), intrenchment: s(foxholeShape.pieces, "#7a6646", { flat: true }),
  maze: mazeShape, sewer: pipeMouth(), culvert: pipeMouth("#9a948a"),
  gaoler: soldierOf("#4a4a52", "none", "cap"), warder: soldierOf("#3d4a5a", "none", "cap"), gatekeeper: soldierOf("#6b5a3a", "spear", "helmet"), doorkeeper: soldierOf("#7a5a3a", "none", "cap"),
  torturer: biped({ hat: "hood", colour: "#2b2a28", legs: "#3a3633", arms: "forward" }), headsman: headsmanShape,
  liberator: biped({ colour: "#5f8a4a", cloak: "#e3b341", arms: "up" }), detainee: convict(), internee: convict("#c9c2b0"), lifer: convict("#e6a24a"), escapee: s(convict("#e6a24a").pieces, "#e6a24a", { living: true }),
  // Theme 31: heraldry, courts and fealty.
  blazon: banneret("#3f6fa8", icon.crown(), true), pennon: s(flag.pieces, "#c9553f"), oriflamme: banneret("#d9573b", icon.flame(), true), tricolor: banneret("#f4f1ea", [dot(R(-16, -13, -5, 13), "#3f6fa8"), dot(R(5, -13, 16, 13), "#c9553f")]),
  tricolour: banneret("#f4f1ea", [dot(R(-16, -13, -5, 13), "#3f6fa8"), dot(R(5, -13, 16, 13), "#c9553f")]), saltire: banneret("#3f6fa8", [dot(band([[-14, -12], [14, 12]], 2.6), "#f4f1ea"), dot(band([[14, -12], [-14, 12]], 2.6), "#f4f1ea")]),
  chevron: s([part(P(-12, -6, 0, -18, 12, -6, 12, -1, 0, -13, -12, -1), "body")], "#e3b341"), roundel: banneret("#f4f1ea", [dot(E(0, 0, 10, 10, 16), "#3f6fa8"), dot(E(0, 0, 6, 6, 14), "#f4f1ea"), dot(E(0, 0, 3, 3, 10), "#c9553f")]),
  quartering: banneret("#c9553f", [dot(R(-16, -13, 0, 0), "#e3b341"), dot(R(0, 0, 16, 13), "#e3b341")], true), insignia: s(icon.star().map((p) => ({ ...p, pts: at(p.pts, 0, -12, 1.1), detail: false })), "#e3b341"),
  scepter: scepterShape, sceptre: scepterShape, dais: daisShape,
  liege: lord("#7a2a4a"), thane: lord("#5a4a3a", "helmet", "#3d4a5a"), marquess: lord("#3f6fa8", "crown", "#e3b341"), margrave: lord("#4a6a4a", "helmet"), seigneur: lord("#6b3a5a", "cap"),
  baronet: lord("#3d4a5a", "cap", "#5a3a5a"), banneret: s(knight.pieces, "#c9553f"), potentate: lord("#8a3a8a", "crown", "#e3b341"), landgrave: lord("#5a6a3a", "crown", "#3d4a5a"), palatine: lord("#7a3a2a", "crown", "#e3b341"),
  grandee: lord("#2b2a28", "cap", "#a8323a"), princeling: biped({ hat: "crown", colour: "#5f8ac9", h: 32 }), noblewoman: biped({ hat: "bun", robe: true, colour: "#8a3a6a", cloak: "#e3b341" }),
  liegeman: soldierOf("#7a2a4a"), feudatory: biped({ colour: "#8a7656", hat: "cap" }), villein: biped({ colour: "#a8925a", hat: "hood", held: "staff" }), armiger: s(knight.pieces, "#3f6fa8"),
  gallant: biped({ colour: "#3f8a8a", hat: "cap", cloak: "#c9553f", held: "spear" }), patrician: biped({ robe: true, colour: "#f4f1ea", cloak: "#8a3a8a" }),
  regicide: biped({ hat: "hood", colour: "#2b2a28", cloak: "#5a1e1e", arms: "forward" }), perjurer: s(spy.pieces, "#6b6a40"), recreant: s(human.pieces, "#c9b07a"), apostate: biped({ robe: true, colour: "#5a5a62", hat: "hood" }),
  mutineer: s(pirate.pieces, "#8a4a3a"), insurgent: soldierOf("#6b7a4a", "spear", "hood"),
  fealty: rosette(icon.crown(), "#7a2a4a"), homage: rosette(icon.crown(), "#a8323a"), allegiance: rosette(icon.flag(), "#3f6fa8"), oath: rosette(icon.scroll(), "#c9553f"), vow: rosette(icon.heart(), "#8a3a6a"),
  betrayal: rosette([dot(P(-1.5, -9, 1.5, -9, 1.5, 3, 0, 8, -1.5, 3), "#8e98a0"), dot(R(-5, 3, 5, 5), "#6b4a2e")], "#2b2a28"), treachery: rosette(icon.mask(), "#3a2a3a"), perfidy: rosette(icon.mask(), "#4a2a2a"),
  knighthood: rosette(icon.swords(), "#3f6fa8"), heraldry: rosette(icon.flag("#3f6fa8"), "#e3b341"), challenge: rosette(icon.swords(), "#c9553f"), melee: rosette(icon.bang(), "#c9553f"),
  jailbreak: rosette(icon.key(), "#e6a24a"), breakout: rosette(icon.bang(), "#e6a24a"), liberation: rosette(icon.chain(), "#5f8a4a"), incarceration: rosette(icon.chain(), "#4a4a52"), captivity: rosette(icon.chain(), "#5a5a62"),
  // Frequency batch 1.
  animal: quad({ len: 38, h: 13, leg: 12 }), someone: job("#8e98a0", "hood"), somebody: job("#a8a29a", "hair"), backup: soldierOf("#4a5a6a", "none", "helmet"),
  developer: job("#5f8a4a", "hair", { arms: "forward" }), tourist: job("#e6a24a", "cap", { legs: "#c9a77a" }), aunt: job("#8a5ac9", "bun", { robe: true }), gentleman: job("#2f2c33", "tophat", { legs: "#2b2a28" }),
  activist: job("#c9553f", "cap", { arms: "up" }), companion: job("#3f8a8a", "hair", { cloak: "#6b4a2e" }), consultant: job("#4a4a52", "hair", { belt: "#c9553f" }), feminist: job("#8a3a6a", "hair", { arms: "up" }),
  babe: baby, infant: baby, grandma: job("#9a7aa8", "bun", { robe: true, h: 36 }), neighbor: job("#c9775a", "cap"), darling: job("#d4476a", "bun", { robe: true }), provider: job("#7a8a4a", "cap", { arms: "forward" }),
  teenager: job("#5f8ac9", "hair", { h: 34, legs: "#3f6fa8" }), bride: job("#f6f2ea", "bun", { robe: true, cloak: "#fbf7ec" }), widow: job("#2b2a28", "hood", { robe: true }), contractor: job("#e6a24a", "helmet", { legs: "#3f6fa8" }),
  notable: job("#7a2a4a", "tophat"), supporter: job("#c9553f", "cap", { arms: "up", legs: "#3f6fa8" }), blonde: job("#d4476a", "bun", { robe: true }), visitor: job("#8a7656", "cap", { cloak: "#6b4a2e" }),
  nephew: job("#5f8a4a", "hair", { h: 30, legs: "#3f6fa8" }), survivor: job("#8a7a5a", "hair", { legs: "#5a4636", belt: "#6b4a2e" }), affiliate: job("#4a6a8a", "hair"), pal: job("#c9773a", "cap"),
  colleague: job("#4a6a8a", "hair", { belt: "#2b2a28" }), freshman: job("#3f8a5a", "cap", { h: 34 }), bachelor: job("#3d4a5a", "hair", { belt: "#c9a24a" }), businessman: job("#3a3633", "hair", { belt: "#a8323a", legs: "#2b2a28" }),
  dame: job("#6b3a5a", "bun", { robe: true, cloak: "#e3b341" }), deceased: s(biped({ colour: "#9a948a", hat: "none" }).pieces.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [-y - 20, x / 3 - 4] as Pt) })), "#9a948a"),
  secular: job("#7a7f86", "hair"), spouse: job("#3f6fa8", "bun", { robe: true }), vegan: job("#5f8a4a", "hair", { belt: "#7fae5a" }), adviser: job("#5a4a3a", "hair", { robe: true }), advisor: job("#5a4a3a", "hair", { robe: true }),
  recipient: job("#7a8a9a", "hair", { arms: "forward" }), mentor: job("#6b5a3a", "hair", { robe: true, held: "staff" }), keeper: soldierOf("#5a4a3a", "staff", "cap"), rider: job("#7a4a2e", "cap", { held: "spear", legs: "#5a3a20" }),
  administrator: lord("#3d4a5a", "cap", "#5a5a62"), canon: biped({ robe: true, colour: "#f4f1ea", hat: "cap", cloak: "#a8323a" }), superintendent: lord("#4a4a52", "cap", "#3d4a5a"), escort: soldierOf("#3d4a5a", "spear", "helmet"),
  ally: soldierOf("#5f8a4a", "spear", "helmet"), infantry: crowd(soldierOf("#6b7a4a"), 4), workforce: crowd(biped({ colour: "#e6a24a", legs: "#3f6fa8", hat: "cap" }), 4), kitty: s(cat.pieces, "#e6a24a", { living: true }),
  tv: computer, interface: computer, holder: s(box.pieces, "#7d7f80"), scan: scanShape, roller: s(barrel.pieces, "#7d7f80"), shooter: gun, plug: plugShape, cylinder: cylinderShape, heating: radiator,
  pipeline: pipelineShape, drain: drainShape, pic: picture(), ceiling: ceilingShape, installation: house({ w: 44, h: 26, roof: "flat", wall: "#9aa3a8", windows: 2 }),
  metro: train("#c9553f"), subway: train("#4a4a52"), transit: car({ cab: "bus", len: 52, colour: "#3f8a8a" }), cab: car({ colour: "#f4c95d" }), rental: car({ colour: "#5f8ac9" }), airline: plane({ kind: "jet", colour: "#f4f1ea" }),
  inventory: chest, setup: s(machine.pieces, "#5f8a8a"), slot: s(box.pieces, "#4a4a52"), import: s(box.pieces, "#a8805a"), merchandise: s(box.pieces, "#c9553f"), workplace: house({ w: 46, h: 30, roof: "flat", wall: "#b0553f", windows: 4, floors: 2 }),
  cart: cartShape, intake: cup, artillery: cannon, skirt: skirtShape, aggregate: s(pile.pieces, "#9a948a"), doll: dollShape, hobby: s(guitar.pieces, "#5f8a4a"), ace: aceShape,
  cocaine: s(pile.pieces, "#f4f1ea"), dot: dotShape, supplement: s(potion.pieces, "#e6a24a"), accommodation: house({ w: 40, h: 28, roof: "gable", wall: "#e9e2d0", windows: 3 }),
  cemetery: grave(), boundary: fence, clearing: s(grass.pieces, "#9ac46a"), habitat: tree({ kind: "bush" }), wilderness: tree({ kind: "pine" }), terrain: sign(icon.mountain()), junction: road, interstate: road,
  neighbourhood: house({ w: 38, h: 26, roof: "gable", windows: 2 }), acre: farm, delta: sign(icon.wave()), continent: sign(icon.island()), sierra: sign(icon.mountain()), peninsula: sign(icon.island()), dale: s(grass.pieces, "#7fae5a"), mainland: sign(icon.island()),
  admission: card, artwork: picture("#e6a24a", "#c9a24a"), gospel: book, homework: s(book.pieces, "#5f8ac9"), recipe: letter, reference: book, thesis: s(book.pieces, "#3d4a5a"), visa: s(letter.pieces, "#a8323a"), manga: s(book.pieces, "#d4476a"), movie: camera,
  // Frequency batch 2.
  researcher: job("#f3f1ea", "hair", { legs: "#5a6a7a", arms: "forward" }), subsidiary: job("#7a8a9a", "cap"), alcoholic: job("#8a6a4a", "hair", { legs: "#5a4636" }), coordinator: job("#3f8a8a", "hair", { arms: "up" }),
  humanitarian: job("#f4f1ea", "cap", { belt: "#c9553f" }), mod: job("#5a5aa8", "hair", { held: "staff" }), nationalist: job("#a8323a", "cap", { arms: "up" }), observer: job("#6b7a4a", "hood", { arms: "forward" }),
  papa: job("#4a6a8a", "hair", { beard: "#5a3a20" }), lad: job("#5f8ac9", "cap", { h: 36 }), browser: job("#a8a29a", "hair"), mommy: job("#d4476a", "bun", { robe: true }), ranger: job("#5a6a3a", "cap", { held: "staff", belt: "#6b4a2e" }),
  mistress: job("#7a2a4a", "bun", { robe: true }), yahoo: job("#c9775a", "cap", { arms: "up", legs: "#5a4636" }), blogger: job("#3f8a6a", "hair", { arms: "forward" }), grandson: job("#5f8a4a", "hair", { h: 30 }),
  undergraduate: job("#3f6fa8", "cap", { h: 36 }), ruler: lord("#5a2a6a", "crown"), supplier: job("#a8805a", "cap", { belt: "#5a3a20" }), freeman: job("#8a7656", "hair", { held: "spear" }),
  superstar: job("#e3b341", "hair", { arms: "up", cloak: "#c9553f" }), toddler: biped({ h: 24, head: 7, hat: "hair", colour: "#f4c95d", legs: "#5f8ac9" }), maiden: job("#e9a8b8", "bun", { robe: true }), niece: job("#d4476a", "bun", { h: 30, robe: true }),
  predecessor: job("#6b5a3a", "hair", { robe: true, beard: "#d9d2c6" }), gal: job("#c9553f", "bun"), pupil: job("#3f8a5a", "cap", { h: 30 }), roommate: job("#7a8a4a", "hair"), fatty: biped({ w: 14, colour: "#c9775a", legs: "#3a3633" }),
  grandpa: job("#7a6a5a", "hair", { held: "staff", beard: "#e9e2d0", h: 36 }), madame: job("#6b3a5a", "bun", { robe: true, cloak: "#2f2c33" }), performer: job("#c9553f", "tophat", { arms: "up" }), belle: job("#f4c6d0", "bun", { robe: true, cloak: "#e9a8b8" }),
  counselor: job("#5a7a8a", "hair", { arms: "forward" }), departed: biped({ ghost: true, colour: "#d9dde0", hat: "none" }), lightweight: job("#c9553f", "none", { legs: "#2f2c33", arms: "up" }), vegetarian: job("#7fae5a", "hair"),
  bravo: job("#2f2c33", "hood", { held: "spear", cloak: "#5a2a2a" }), insider: job("#3a3633", "hair", { belt: "#5a5a62" }), offspring: crowd(biped({ h: 24, colour: "#e6a24a", legs: "#5f8ac9" }), 3), presenter: job("#3f6fa8", "hair", { arms: "up", belt: "#c9a24a" }),
  valentine: job("#d4476a", "hair", { cloak: "#a8323a" }), viewer: job("#7a8a9a", "hair", { arms: "forward" }), wheeler: job("#8a6440", "cap", { belt: "#5a3a20", arms: "forward" }), bum: job("#7a6a5a", "hood", { legs: "#5a4636" }),
  temp: job("#9aa3a8", "hair", { belt: "#e6a24a" }), veterinary: job("#f3f1ea", "hair", { legs: "#3f8a6a" }), auxiliary: soldierOf("#7a8a5a", "spear", "cap"), psycho: job("#8a2a2a", "hair", { arms: "up", legs: "#2b2a28" }),
  sweetheart: job("#e9a8b8", "bun", { robe: true, cloak: "#d4476a" }), patriot: soldierOf("#3f6fa8", "spear", "cap"), sherlock: job("#8a7656", "cap", { cloak: "#6b5a3a" }), contributor: job("#5f8a8a", "hair", { arms: "forward" }),
  hulk: biped({ h: 54, w: 15, colour: "#5f8a4a", skin: "#8ab06a", hat: "none", legs: "#5a3a6a" }), pedestrian: job("#8a7a6a", "hair"), tribune: lord("#f4f1ea", "hair", "#a8323a"), apprentice: job("#a8805a", "cap", { h: 34, arms: "forward" }),
  eldest: job("#4a5a6a", "hair", { cloak: "#6b4a2e" }), neighbour: job("#c9775a", "cap"), sophomore: job("#3f8a5a", "cap", { h: 35 }), addict: job("#8e8b80", "hood", { legs: "#5a5a5a" }), clone: crowd(job("#9aa3a8", "hair"), 3),
  freelance: job("#c97a3a", "hair", { arms: "forward" }), protector: soldierOf("#3d4a5a", "staff", "helmet"), trustee: job("#3a3633", "hair", { belt: "#c9a24a" }), commentator: job("#4a4a52", "hair", { arms: "forward", belt: "#c9553f" }),
  protagonist: job("#c9553f", "hair", { cloak: "#3f6fa8", held: "spear" }), crossover: job("#6b5a8a", "hood"), distributor: job("#a8805a", "cap", { arms: "forward" }),
  airplane: plane({ kind: "jet", colour: "#f4f1ea" }), bomber: plane({ kind: "jet", colour: "#6b7a5a" }), pickup: car({ cab: "truck", colour: "#c9553f" }), carriage: carriageShape(), surrey: carriageShape("#6b4a2e"), quad: quadShape,
  shotgun: shotgunShape, firearm: gun, shaft: shaftShape, mesh: s(armor.pieces, "#9aa3a8"), brace: s(glove.pieces, "#7d7f80"), saddle: saddleShape, perfume: s(bottle.pieces, "#e9a8b8"), cosmetic: s(potion.pieces, "#d4476a"),
  heroin: s(pile.pieces, "#e9e2d0"), dope: s(pile.pieces, "#7fae5a"), batch: bread, bot: bug({ kind: "worm", colour: "#c9b08a" }), sphere: sphereShape, cone: coneShape, coil: coilShape, drawer: drawerShape,
  sculpture: sculptureShape(), replica: sculptureShape("#e9e2d0"), masterpiece: picture("#c9773a", "#c9a24a"), miniature: picture("#5f8ac9", "#e3b341"), scenery: flatShape, sticker: stickerShape, pixel: pixelShape,
  manuscript: scroll, diagram: s(map.pieces, "#cfe3ea"), memo: letter, atlas: s(book.pieces, "#3f8a6a"), mag: s(book.pieces, "#e8892e"), transcript: s(letter.pieces, "#f4f1ea"),
  commodity: s(box.pieces, "#a8805a"), shipment: s(box.pieces, "#8a6440"), batting: s(pile.pieces, "#f4f1ea"), bracket: s(ingot.pieces, "#8e98a0"), rim: s(ring.pieces, "#8e98a0"), tee: s(dotShape.pieces, "#f4f1ea"), hank: s(rope.pieces, "#e9e2d0"),
  sewing: s(rope.pieces, "#c9553f"), seating: bench, vent: s(radiator.pieces, "#9aa3a8"), curb: s(brickWall(40, 1, "#9a948a").pieces, "#9a948a"), fixture: lamp, prop: s([part(band([[-6, 0], [4, -40]], 3), "body"), part(R(-10, -2, 0, 0), "#6b4a2e"), part(R(0, -42, 10, -38), "#6b4a2e")], "#a8805a"), coping: brickWall(40, 1, "#bfb3a0"),
  niche: house({ w: 26, h: 26, roof: "dome", wall: "#bfb3a0" }), obstacle: s(rock.pieces, "#8e8b80"), rig: rigShape, automation: armShape, prototype: s(machine.pieces, "#5f8ac9"), apparatus: s(machine.pieces, "#8e98a0"),
  urine: s(puddle.pieces, "#e6d35e"), enzyme: s(potion.pieces, "#7fae5a"), catalyst: s(crystal.pieces, "#c9d1d6"), amino: s(pile.pieces, "#f4f1ea"), volatile: s(bottle.pieces, "#e6a24a"), lump: s(rock.pieces, "#9a948a"), scum: s(puddle.pieces, "#6f9a50"),
  node: bump("#c97a7a"), prostate: bump("#b8605a"), sac: bump("#d9a08a"), pentagon: pentagonShape, gateway: gate, runway: runwayShape, alley: s(road.pieces, "#8a7a6a"), intersection: road, pathway: s(road.pieces, "#c9a77a"), boulevard: road, sidewalk: s(road.pieces, "#bfb3a0"), aisle: s(road.pieces, "#c9bca4"),
  countryside: s(grass.pieces, "#8ab45a"), hometown: house({ w: 38, h: 26, roof: "gable", windows: 2, sign: "#5f8a4a" }), landmark: tower, backyard: fence, suburb: house({ w: 40, h: 24, roof: "gable", windows: 2, wall: "#e9e2d0" }),
  reservoir: s(puddle.pieces, "#5f8ac9"), brook: s(puddle.pieces, "#7fb4d8"), vegetation: tree({ kind: "bush" }), isle: sign(icon.island()), slope: sign(icon.mountain()), glen: sign(icon.hole()), apex: sign(icon.mountain(), "#fbf6ea", "#8e98a0"),
  notch: sign(icon.mountain(), "#fbf6ea", "#a8916a"), strand: sign(icon.wave(), "#fbf6ea", "#e6d3a3"), riverside: sign(icon.wave()), downhill: sign(icon.mountain(), "#fbf6ea", "#7fae5a"),
  // Frequency batch 5.
  dreamer: job("#9cb4d8", "hair", { robe: true, arms: "up" }), finder: job("#a8805a", "cap", { arms: "forward", belt: "#e3b341" }), minimalist: job("#e9e2d0", "hair", { legs: "#e9e2d0" }),
  postgraduate: job("#3a3633", "hair", { cloak: "#2b2a28", belt: "#c9a24a" }), grader: job("#5a6a7a", "hair", { arms: "forward", belt: "#c9553f" }), literate: job("#3f6fa8", "hair", { arms: "forward" }),
  saver: job("#5f8a4a", "hair", { belt: "#e3b341" }), youngster: biped({ h: 30, colour: "#e3b341", legs: "#3f4a5a", hat: "cap", arms: "up" }), camper: job("#5f7a4a", "cap", { held: "staff", legs: "#7a5a3a" }),
  macho: biped({ w: 12, colour: "#c9553f", legs: "#3a3633", hat: "hair", arms: "up", beard: "#5a3a24" }), missy: biped({ h: 32, colour: "#e9a8b8", legs: "#3f4a5a", hat: "bun", hair: "#c9773a" }),
  realist: job("#7a7a72", "hair", { arms: "forward" }), recruiter: job("#5f6a4a", "cap", { arms: "up", belt: "#3d3a33" }), wannabe: job("#d4476a", "cap", { arms: "up", legs: "#3f4a5a" }),
  borrower: job("#8e8b80", "hair", { arms: "forward" }), dandy: job("#8a5ac9", "tophat", { cloak: "#e3b341", belt: "#f4f1ea" }), emeritus: job("#5a4a6a", "hair", { robe: true, beard: "#e9e2d0", held: "staff" }),
  fiancee: biped({ colour: "#f4f1ea", hat: "bun", hair: "#5a3a24", robe: true }), lefty: job("#3f8a6a", "cap", { arms: "up" }), prodigy: biped({ h: 30, colour: "#5fb3c9", legs: "#3a3633", hat: "hair", arms: "up" }),
  sidekick: job("#e3b341", "hair", { cloak: "#3f6fa8", h: 36 }), stepfather: job("#5a6a7a", "hair", { beard: "#5a3a24", belt: "#3a3633" }), tester: job("#e9eef0", "hair", { arms: "forward", belt: "#5fb3c9" }),
  deb: biped({ colour: "#e9a8b8", hat: "bun", hair: "#e3b341", robe: true }), redhead: biped({ colour: "#3f8a6a", hat: "hair", hair: "#c9452a", legs: "#3a3633" }), taker: job("#6b5a4a", "hair", { arms: "forward" }),
  laureate: job("#2f4a3a", "hair", { cloak: "#e3b341", robe: true }), reactionary: job("#5a2a2a", "hair", { belt: "#3a3633", arms: "forward" }), squirt: biped({ h: 26, colour: "#7fae5a", legs: "#3f4a5a", hat: "cap" }),
  modernist: job("#2b2a28", "hair", { cloak: "#d4476a" }), schoolboy: biped({ h: 30, colour: "#3f6fa8", legs: "#3a3633", hat: "cap", belt: "#c9553f" }), slider: job("#c9553f", "helmet", { arms: "forward", legs: "#3f4a5a" }),
  consort: lord("#5a3a6a", "crown", "#8a5ac9"), giver: job("#d98a5a", "hair", { arms: "forward", belt: "#e3b341" }), homeowner: job("#7a8a6a", "hair", { belt: "#8a6440" }), newbie: biped({ h: 36, colour: "#9aa3a8", legs: "#3f4a5a", hat: "cap" }),
  admirer: job("#e9a8b8", "hair", { arms: "up" }), craven: job("#c9c49a", "hood", { arms: "up", legs: "#7a7a6a" }), scholastic: job("#3a3633", "hair", { robe: true, held: "staff" }),
  adventurer: job("#a8805a", "cap", { held: "staff", cloak: "#5f7a4a", belt: "#6b4a2e" }), bachelorette: biped({ colour: "#d4476a", hat: "halo", hair: "#e3b341", robe: true, arms: "up" }), drinker: job("#8a5a3a", "cap", { arms: "up", belt: "#3a3633" }),
  intermediary: job("#5a7a8a", "hair", { arms: "forward", belt: "#f4f1ea" }), sitter: job("#a88aa8", "bun", { robe: true, h: 36 }), tout: job("#c9a24a", "tophat", { arms: "up" }), absentee: biped({ ghost: true, colour: "#d9d2c6", skin: "#d9d2c6", hat: "hair" }),
  centrist: job("#8a8a9a", "hair", { belt: "#5a5a62" }), passer: job("#7a6a5a", "cap", { legs: "#4a4a52" }), screenwriter: job("#4a4a52", "hair", { arms: "forward", belt: "#e3b341" }), anthropologist: job("#a8916a", "cap", { held: "staff" }),
  aunty: job("#c9773a", "bun", { robe: true, h: 36 }), stepmother: job("#5a2a5a", "bun", { robe: true }), theorist: job("#5a5a62", "hair", { beard: "#8e8b80", arms: "forward" }), whistler: job("#5fb3c9", "cap", { arms: "up" }),
  yogi: biped({ colour: "#e6a24a", hat: "bun", robe: true, arms: "up", skin: "#c9956a" }), gent: job("#3a3633", "tophat", { belt: "#8a6440" }), naturalist: job("#5f8a4a", "hood", { held: "staff", legs: "#6b4a2e" }),
  proponent: job("#3f6fa8", "hair", { arms: "up", belt: "#e3b341" }), claimant: job("#8a6a4a", "hair", { arms: "forward", belt: "#c9a24a" }), hater: job("#2b2a28", "hood", { arms: "forward", legs: "#5a2a2a" }),
  terminator: job("#7a7a6a", "cap", { held: "spear", belt: "#c9553f" }), picket: job("#c9553f", "cap", { held: "staff", arms: "up" }), tracer: job("#4a4a52", "hood", { arms: "forward" }),
  dodger: job("#5a5a62", "cap", { legs: "#2b2a28", arms: "forward" }), subversive: job("#2b2a28", "hood", { cloak: "#a8323a" }),
  stoner: soldierOf("#8a7a60", "none", "cap"), fanatic: soldierOf("#a8323a", "spear", "hood"), conqueror: lord("#5a5a62", "helmet", "#a8323a"), equestrian: s([...horse.pieces, ...moved(job("#a8323a", "helmet"), -2, -30, 0.7).pieces], "#8a5a3a", { living: true }),
  letterman: biped({ w: 11, colour: "#c9553f", legs: "#3f4a5a", hat: "helmet", arms: "up", belt: "#f4f1ea" }), finisher: soldierOf("#2b2a28", "spear", "hood"),
  goliath: biped({ h: 64, w: 13, colour: "#8a6a4a", legs: "#4a4a52", hat: "helmet", held: "spear", beard: "#3a2a1e" }),
  strategist: job("#3f4a5a", "cap", { arms: "forward", belt: "#e3b341" }), proctor: job("#2b2a28", "hair", { robe: true, arms: "forward" }), shaker: job("#c9553f", "tophat", { arms: "up", belt: "#e3b341" }),
  totalitarian: lord("#3a3633", "cap", "#5a2a2a"), councilman: job("#3a4a5a", "hair", { belt: "#c9a24a" }), laird: lord("#3f6a4a", "hair", "#5a3a6a"), politico: job("#2f2c33", "hair", { arms: "up", belt: "#3f6fa8" }),
  chairperson: job("#5a3a3a", "hair", { arms: "forward", belt: "#e3b341" }), provost: job("#2b2a28", "hair", { robe: true, cloak: "#a8323a" }), imperialist: lord("#a8323a", "helmet", "#e3b341"),
  cupid: biped({ h: 22, colour: "#f4f1ea", skin: "#f3d9be", hat: "hair", hair: "#e3b341", wings: "feather", arms: "forward" }), wight: s(spirit("#b8d4e0").pieces, "#b8d4e0", { living: true }),
  birdie: bird({ size: 0.6, colour: "#e3b341", flies: true }), ani: bird({ size: 0.8, colour: "#2b2a28", hooked: true }),
  takin: quad({ len: 30, h: 18, leg: 12, neck: 6, head: 7, snout: 3, ear: "point", tail: "stub", colour: "#c9a24a" }), mammalian: s(dog.pieces, "#8a6a4a", { living: true }),
  corolla: flower("#d4476a", 5, 14), bluegrass: s(grass.pieces, "#6a8ab4", { flat: true }), biennial: flower("#e3b341", 8, 18), pollard: tree({ kind: "round", h: 34, colour: "#5f8a4a" }),
  dal: s(cup.pieces, "#e3b341"), carcass: s(meat.pieces, "#8a3a2a"), soma: s(potion.pieces, "#8a5ac9"), tot: s(cup.pieces, "#a8703c"),
  bayonet: bayonetShape, aeroplane: plane({ kind: "plane", colour: "#c9323a" }), omnibus: car({ cab: "bus", len: 54, h: 22, wheels: 2, windows: 5, colour: "#c9323a" }), hackney: carriageShape("#2b2a28"),
  tripod: tripodShape, helix: helixShape, floppy: floppyShape, moustache: moustacheShape, orb: orbShape(), blower: blowerShape, grating: gratingShape, coulter: coulterShape, splinter: splinterShape,
  hamper: hamperShape, oculus: oculusShape, pulpit: pulpitShape, castor: castorShape,
  embroidery: hoopShape, eyeliner: pencilShape(), eyeshadow: s(coins.pieces, "#8a5ac9"), thumbnail: bump("#efcfae"),
  skid: slabShape("#a8703c"), requisite: s(box.pieces, "#8e98a0"), commemorative: coins, gimmick: giftShape("#e3b341"), kern: s(ingot.pieces, "#5a5a62"), collectible: dollShape,
  playhouse: house({ w: 24, h: 18, roof: "gable", windows: 1, wall: "#f4d35e" }), polytechnic: s(school.pieces, "#8a6a5a"),
  shroud: s(cloak.pieces, "#f4f1ea"), wrapper: s(cloak.pieces, "#e9a8b8"), carton: s(box.pieces, "#e9e2d0"),
  ethernet: plugShape, hookup: s(plugShape.pieces, "#5a5a62"), nonfiction: book, tabloid: s(letter.pieces, "#f4f1ea"), taping: s(radio.pieces, "#3a3633"), codex: s(book.pieces, "#6b3a1e"), monograph: s(book.pieces, "#3f6a4a"),
  backseat: s(chair.pieces, "#5a4636"), kinase: s(potion.pieces, "#7fae5a"), roofing: s(sheet.pieces, "#5a5a62"), lagging: s(sheet.pieces, "#e3b341"), sizing: s(bottle.pieces, "#e9d070"), floss: s(rope.pieces, "#f4f1ea"),
  ply: s(sheet.pieces, "#c9a06a"), snuff: s(box.pieces, "#6b4a2e"), actin: s(crystal.pieces, "#e9a8b8"), serotonin: s(potion.pieces, "#5fb3c9"), catheter: s(coilShape.pieces, "#e9eef0"), refill: s(bottle.pieces, "#7fc4d8"), antigen: antibodyShape,
  overlay: s(armor.pieces, "#a8703c"), shielding: s(armor.pieces, "#5a5a62"), deflection: s(shield.pieces, "#9cc6d2"), padding: s(armor.pieces, "#e9e2d0"),
  speedway: road, detour: s(road.pieces, "#e6a24a"), airway: pipelineShape, walkway: s(road.pieces, "#bfb3a0"), stairway: stairsShape, stair: s(stairsShape.pieces, "#a8703c"),
  rectangle: slabShape("#bfb3a0"), woodwork: s(frameShape.pieces, "#a8703c"), rung: s(ladder.pieces, "#a8703c"), signage: sign(icon.arrow()), strut: s(frameShape.pieces, "#8e98a0"), edging: brickWall(40, 1, "#9a948a"),
  incline: sign(icon.mountain(), "#fbf6ea", "#a8916a"), vantage: sign(icon.eye()), heartland: s(grass.pieces, "#a8b45a"), slum: house({ w: 30, h: 18, roof: "flat", windows: 1, wall: "#a8a094" }),
  outback: sign(icon.sun(), "#fbf6ea", "#d9a05a"), wasteland: sign(icon.skull(), "#fbf6ea", "#8a7a60"), piazza: sign(icon.house(), "#fbf6ea", "#d9c6a0"),
  waterway: s(puddle.pieces, "#5f8ac9"), tributary: s(puddle.pieces, "#7fb4d8"), bayou: s(puddle.pieces, "#4a6a3a"),
  // Frequency batch 4.
  enthusiast: job("#e3b341", "cap", { arms: "up", belt: "#c9553f" }), sleeper: job("#9cb4d8", "none", { robe: true, legs: "#9cb4d8" }), brat: biped({ h: 28, colour: "#d4476a", legs: "#3f4a5a", hat: "hair", arms: "up" }),
  entertainer: job("#8a5ac9", "tophat", { arms: "up", cloak: "#e3b341" }), wally: job("#c9a24a", "cap", { arms: "up", legs: "#7a5a3a" }), subordinate: job("#7a8a9a", "hair", { arms: "forward" }),
  gran: job("#a88aa8", "bun", { robe: true, held: "staff", h: 36 }), obsessive: job("#4a5a6a", "hair", { arms: "forward", belt: "#c9553f" }), pol: job("#2f2c33", "hair", { belt: "#c9553f", arms: "up" }),
  sire: lord("#5a2a2a", "crown", "#3a3633"), trainee: job("#7fae5a", "cap", { h: 36 }), visionary: job("#5fb3c9", "hair", { cloak: "#8a5ac9", held: "staff" }), cad: job("#3a3633", "tophat", { cloak: "#a8323a" }),
  hubby: job("#5a6a7a", "hair", { legs: "#3a3633", belt: "#8a6440" }), momma: job("#c9553f", "bun", { robe: true }), seeker: job("#a8805a", "hood", { held: "staff", arms: "forward" }),
  brunette: biped({ colour: "#3f8a6a", hair: "#5a3a24", hat: "bun", legs: "#3a3633" }), fiance: job("#2f2c33", "hair", { belt: "#f4f1ea" }), housewife: job("#e9a8b8", "bun", { robe: true, arms: "forward" }),
  hypocrite: job("#6b5a8a", "hair", { cloak: "#2f2c33" }), newcomer: job("#9aa3a8", "cap", { h: 36 }), sinner: job("#5a2a2a", "hood"), thinker: job("#8e8b80", "hair", { beard: "#8e8b80", robe: true }),
  advertiser: job("#e6a24a", "hair", { arms: "up", belt: "#d4476a" }), guerrilla: soldierOf("#5f7a4a", "spear", "cap"), cosmopolitan: job("#3f6fa8", "tophat", { cloak: "#e9e2d0" }), eater: biped({ w: 13, colour: "#c9773a", legs: "#3a3633", hat: "hair" }),
  fodder: crowd(soldierOf("#7a7a6a", "spear", "helmet"), 4), git: job("#6b6a66", "cap", { arms: "forward" }), hippie: biped({ colour: "#e6a24a", hat: "hair", hair: "#8a6440", robe: true, legs: "#3a3633" }), mastermind: job("#2f2c33", "hair", { cloak: "#5a2a5a", arms: "forward" }),
  purchaser: job("#5a7a6a", "hair", { belt: "#c9a24a" }), breeder: job("#7a5a3a", "cap", { held: "staff" }), hipster: job("#5a5a62", "cap", { beard: "#5a3a24", legs: "#3f4a5a" }), learner: biped({ h: 32, colour: "#5f8ac9", legs: "#3f4a5a", hat: "hair" }),
  adept: job("#3f8a8a", "hood", { held: "staff", cloak: "#2f6a6a" }), eclectic: job("#d4476a", "tophat", { cloak: "#7fae5a" }), weirdo: biped({ colour: "#7fae5a", hat: "hair", hair: "#8a5ac9", arms: "up", legs: "#3a3633" }),
  maverick: job("#8a6440", "cap", { cloak: "#c9553f", arms: "forward" }), surrogate: job("#d9c6a0", "hair", { legs: "#8e8b80" }), counsellor: job("#5f8a4a", "hair", { arms: "forward", belt: "#e3b341" }),
  eyewitness: job("#8e98a0", "cap", { arms: "forward" }), mamma: job("#a8323a", "bun", { robe: true }), intruder: job("#2b2a28", "hood", { legs: "#2b2a28", arms: "forward" }), auntie: job("#d98a5a", "bun", { robe: true, h: 36 }),
  cameraman: job("#4a4a52", "cap", { arms: "forward", belt: "#2b2a28" }), descendant: job("#c9a24a", "hair", { h: 34 }), rounder: job("#a8323a", "tophat", { legs: "#3a3633" }), smoker: job("#8e8b80", "cap", { arms: "up" }),
  rustic: job("#8a6a4a", "cap", { held: "staff", legs: "#5a4636" }), proprietor: job("#2f4a3a", "tophat", { belt: "#c9a24a" }), daredevil: job("#c9553f", "helmet", { arms: "up", cloak: "#e3b341" }),
  adversary: soldierOf("#3a2a2a", "spear", "helmet"), compulsive: job("#7a6a8a", "hair", { arms: "forward" }), exporter: job("#3f6fa8", "hair", { belt: "#a8703c" }), beneficiary: job("#e3b341", "hair", { belt: "#7fae5a" }),
  biker: job("#2b2a28", "helmet", { legs: "#3f4a5a", arms: "forward" }), classmate: biped({ h: 32, colour: "#c9553f", legs: "#3f4a5a", hat: "cap" }), unionist: job("#a8323a", "cap", { arms: "up", belt: "#3a3633" }),
  populist: job("#c9553f", "hair", { arms: "up", belt: "#3f6fa8" }), nemesis: biped({ colour: "#2b2a28", skin: "#9aa3a8", hat: "hood", cloak: "#5a2a2a", held: "spear", arms: "up" }),
  divinity: god, embodiment: s(spirit("#e9d8a6").pieces, "#e9d8a6", { living: true }), incarnation: biped({ robe: true, hat: "halo", colour: "#f4d35e", skin: "#f3d9be" }),
  fay: biped({ h: 20, colour: "#7fae5a", hat: "hair", hair: "#e3b341", wings: "feather" }), roach: bug({ kind: "beetle", colour: "#6b3a1e" }), dun: s(horse.pieces, "#9a8a6a", { living: true }),
  feeder: s(cow.pieces, "#a8805a", { living: true }), mara: quad({ len: 22, h: 12, leg: 12, neck: 8, head: 4, snout: 3, ear: "point", tail: "stub", colour: "#a88a5a" }),
  spawn: s(pebbles.pieces, "#c9d4a0", { flat: true }), maize: s([part(band([[0, 0], [0, -40]], 1.6), "#6f9a50"), ...[-1, 1].map((d) => glue(P(0, -18, d * 12, -28, d * 4, -20), "#7fae5a")), part(E(3, -26, 3, 8, 12), "#e3b341", 1), dot(band([[3, -33], [3, -19]], 0.6), "#c9a24a")], "#6f9a50"),
  embryo: bump("#d9c26a"), ornamental: flower("#d4476a", 8, 20), nutshell: s(rocky.pieces, "#8a6440"),
  zeppelin: zeppelinShape, chariot: chariotShape, revolver: revolverShape, handgun: s(gun.pieces, "#3a3a40"), launcher: launcherShape, crease: krisShape, barb: wire("#8e98a0"),
  ordnance: s(bomb.pieces, "#5f6a4a"), payload: s(bomb.pieces, "#c9553f"), weaponry: s([...moved(sword(), -8, 0).pieces, ...moved(spear, 8, 0).pieces, ...moved(axe, 0, 0, 0.8).pieces], "#cfd6da"),
  airbus: plane({ kind: "jet", colour: "#e9eef0" }), commuter: train("#5f8a4a"), decker: car({ cab: "bus", len: 58, h: 24, wheels: 2, windows: 5, colour: "#c9323a" }), barrow: s(cartShape.pieces, "#5f8a4a"),
  horseback: s([...horse.pieces, ...moved(saddleShape, -2, -30, 0.8).pieces], "#8a5a3a", { living: true }), radial: tyreShape, binder: s(machine.pieces, "#c9a24a"), converter: s(machine.pieces, "#5f8ac9"),
  prism: prismShape, windshield: windshieldShape, fender: fenderShape, casing: s(cylinderShape.pieces, "#8e98a0"), hinge: hingeShape, electrode: electrodeShape, instrumentation: s(compass.pieces, "#c9a24a"),
  override: s(machine.pieces, "#c9553f"), constraint: cuffs(), lucifer: s(torch.pieces, "#e6c89a"), taper: torch, fluorescent: stripLight, illumination: lamp, bender: s(crowbar.pieces, "#5a5a62"),
  adjunct: plugShape, seizing: s(rope.pieces, "#c9a77a"), standby: s(box.pieces, "#5f8a4a"), memorabilia: giftShape("#3f6fa8"), repository: vault, denomination: coins,
  collage: picture("#e6a24a", "#f4f1ea"), montage: picture("#8a5ac9", "#2b2a28"), doodle: s(scroll.pieces, "#f4f1ea"), engraving: picture("#c9773a", "#8a6440"),
  dossier: s(letter.pieces, "#c9a77a"), glossy: picture("#5fb3c9", "#fbf7ec"), obituary: s(letter.pieces, "#2b2a28"), postcard: picture("#7fb4d8", "#f4f1ea"), snapshot: picture("#9cc6d2", "#f4f1ea"), stationery: letter,
  knitting: s(cloak.pieces, "#c9453f"), aba: s(cloak.pieces, "#8a6440"), reversible: s(cloak.pieces, "#5f7a4a"), spat: s(boot.pieces, "#f4f1ea"), trapping: s(saddleShape.pieces, "#a8323a"), wearable: wristShape,
  anesthesia: s(bottle.pieces, "#e9eef0"), dopamine: s(potion.pieces, "#d4476a"), corrective: s(armor.pieces, "#e9e2d0"), truss: s(armor.pieces, "#d9c6a0"), infusion: s(cup.pieces, "#c9a24a"), nip: s(bottle.pieces, "#a8703c"),
  additive: s(bottle.pieces, "#e3b341"), inhibitor: s(potion.pieces, "#5f8ac9"), lipid: s(puddle.pieces, "#e9d070"), moderator: s(ingot.pieces, "#3a3a40"), peptide: s(crystal.pieces, "#e9a8b8"),
  precursor: s(potion.pieces, "#7fae5a"), stripper: s(bottle.pieces, "#c9553f"), seam: s(sheet.pieces, "#2b2a28"), pinky: bump("#efcfae"),
  neutron: particle("#9aa3a8"), proton: particle("#d4476a"), discard: s(pile.pieces, "#a8a094"), scraping: s(pebbles.pieces, "#8e98a0"),
  lattice: latticeShape, masonry: brickWall(40, 3, "#bfb3a0"), pedestal: pedestalShape(), piling: pilingShape, traverse: frameShape,
  conduit: pipelineShape, piping: s(pipelineShape.pieces, "#c9773a"), tubing: s(coilShape.pieces, "#5a5a5a"), gutter: s(pipelineShape.pieces, "#8e98a0"), manifold: s(pipelineShape.pieces, "#5a5a62"),
  motorway: road, roadway: road, parkway: s(road.pieces, "#7fae5a"), widening: road, roundabout: s(road.pieces, "#8a8a8a"), shortcut: s(road.pieces, "#a8916a"), boardwalk: s(bridge.pieces, "#a8703c"),
  airfield: runwayShape, detox: hospital, highschool: school,
  bog: s(puddle.pieces, "#5a6a3a"), excavation: sign(icon.hole()), ascent: sign(icon.mountain(), "#fbf6ea", "#a8916a"), hillside: sign(icon.mountain(), "#fbf6ea", "#7fae5a"), uphill: sign(icon.mountain()),
  archipelago: sign(icon.island()), greenwood: tree({ kind: "round", colour: "#4f8a3a" }), shoreline: sign(icon.wave(), "#fbf6ea", "#e6d3a3"), underwood: tree({ kind: "bush", colour: "#5f7a3a" }),
  farmland: s(grass.pieces, "#c9b45a"), midland: s(grass.pieces, "#8ab45a"), roadside: s(grass.pieces, "#9ab46a"), loch: s(puddle.pieces, "#3f6a8a"),
  // Frequency batch 3.
  nerd: job("#7a8a9a", "hair", { legs: "#4a5a6a", arms: "forward", belt: "#3f6fa8" }), incompetent: job("#c9a24a", "cap", { arms: "up", legs: "#5a4636" }), kin: crowd(job("#8a6a4a", "hair"), 4),
  sonny: biped({ h: 28, colour: "#5f8ac9", legs: "#3a3633", hat: "cap" }), dummy: biped({ colour: "#d9c6a0", skin: "#d9c6a0", legs: "#d9c6a0", hat: "none" }), applicant: job("#4a5a6a", "hair", { belt: "#3a3633" }),
  lender: job("#3a3633", "tophat", { belt: "#c9a24a" }), mutation: s(monster.pieces, "#7fae5a"), groom: job("#2f2c33", "hair", { belt: "#f4f1ea" }), heavyweight: biped({ h: 46, w: 13, colour: "#c9553f", legs: "#2f2c33", hat: "none", arms: "up" }),
  militant: soldierOf("#6b7a4a", "spear", "hood"), caller: job("#c9775a", "cap", { arms: "up" }), casualty: job("#e9e2d0", "none", { legs: "#c9553f", belt: "#c9553f" }), chap: job("#6b5a3a", "cap"),
  geek: job("#5a8a5a", "hair", { arms: "forward", legs: "#3f4a5a" }), granny: job("#a88aa8", "bun", { robe: true, held: "staff", h: 36 }), sibling: job("#e6a24a", "hair", { h: 34 }),
  granddaughter: biped({ h: 28, hat: "bun", colour: "#e9a8b8", legs: "#5f8ac9", robe: true }), referral: job("#f3f1ea", "hair", { legs: "#5a7a8a" }), authoritarian: lord("#2f2c33", "cap", "#5a2a2a"),
  barker: job("#c9553f", "tophat", { arms: "up", belt: "#e3b341" }), buff: job("#8a6a4a", "hair", { arms: "forward" }), madam: job("#6b3a5a", "bun", { robe: true }), fundraiser: job("#3f8a6a", "hair", { arms: "forward", belt: "#e3b341" }),
  adolescent: biped({ h: 36, colour: "#8a5ac9", legs: "#3f4a5a", hat: "hair" }), beau: job("#3f6fa8", "hair", { cloak: "#d4476a" }), eccentric: job("#8a5ac9", "tophat", { cloak: "#e6a24a", held: "staff" }),
  flyer: job("#5f8ac9", "helmet", { arms: "up", cloak: "#c9553f" }), orphan: biped({ h: 28, colour: "#8e8b80", legs: "#5a4636", hat: "cap" }), traveler: job("#a8805a", "hood", { held: "staff", belt: "#6b4a2e" }),
  traveller: job("#a8805a", "cap", { held: "staff", belt: "#6b4a2e" }), sweetie: job("#e9a8b8", "bun", { robe: true }), organizer: job("#3f8a8a", "hair", { arms: "up", belt: "#3a3633" }), flop: job("#9aa3a8", "hair", { legs: "#6b6a66" }),
  follower: crowd(job("#7a8a9a", "hood"), 3), playboy: job("#f4f1ea", "hair", { legs: "#2f2c33", belt: "#c9a24a" }), promoter: job("#c9553f", "hair", { arms: "up", belt: "#e3b341" }), bloke: job("#5a6a7a", "cap", { legs: "#3a3633" }),
  blond: biped({ colour: "#5f8ac9", hair: "#f4d35e", legs: "#3a3633" }), comrade: soldierOf("#a8323a", "spear", "cap"), outsider: job("#5a5a62", "hood", { cloak: "#3a3633" }), spoiler: job("#2f2c33", "hood", { arms: "forward" }),
  heroine: job("#c9553f", "bun", { cloak: "#3f6fa8", held: "spear" }), planner: job("#3f6fa8", "hair", { arms: "forward", belt: "#e3b341" }), beginner: job("#7fae5a", "cap", { h: 36 }), bilingual: job("#e6a24a", "hair", { arms: "forward" }),
  examiner: job("#f3f1ea", "hair", { legs: "#3a3633", arms: "forward" }), flirt: job("#d4476a", "bun", { robe: true, cloak: "#e9a8b8" }), listener: job("#5a7a6a", "hair"), subscriber: job("#7a8a9a", "cap"),
  interviewer: job("#3a3633", "hair", { arms: "forward", belt: "#c9553f" }), foe: soldierOf("#5a2a2a", "spear", "helmet"), pivot: job("#3f8a5a", "cap", { arms: "up" }), fella: job("#8a6440", "cap"),
  nan: job("#9a8aa8", "bun", { robe: true, h: 36 }), buster: biped({ h: 44, w: 11, colour: "#5a5a62", legs: "#3a3633", hat: "cap" }), mater: job("#8a5ac9", "bun", { robe: true }), reviewer: job("#4a4a52", "hair", { arms: "forward" }),
  voucher: job("#5a6a4a", "hair", { belt: "#c9a24a" }), changer: job("#c9773a", "hair", { arms: "up" }), teaser: job("#e6a24a", "cap", { arms: "up" }), handler: job("#6b5a3a", "cap", { held: "staff", belt: "#5a3a20" }),
  parachute: parachuteShape, ammo: ammoShape, waterfall: waterfallShape(), cascade: waterfallShape("#9cc6d2"), staircase: stairsShape, backdrop: flatShape, backstage: curtainShape, burner: burnerShape,
  carving: sculptureShape("#a8703c"), connector: plugShape, constituent: cogShape(), cozy: cozyShape, disposable: s(cup.pieces, "#f4f1ea"), dolly: s(cartShape.pieces, "#8e98a0"), duplicate: letter, flap: s(cloak.pieces, "#8a6440"),
  fore: boat({ kind: "boat", colour: "#8a6440" }), frontal: s(crown.pieces, "#e3b341"), garner: barn, interchange: road, mosaic: mosaicShape, mound: s(mound.pieces, "#8a6a4a"), mural: picture("#e6a24a", "#bfb3a0"),
  overlapping: s(armor.pieces, "#8e98a0"), plumbing: pipelineShape, rotary: rotorShape, slab: slabShape(), slit: s(dotShape.pieces, "#2b2a28"), spectacle: stage, staging: scaffoldShape, stripe: chevronShape(), tracing: s(map.pieces, "#f4f1ea"),
  tread: tyreShape, trivia: card, ventilation: s(radiator.pieces, "#9aa3a8"), ware: vaseShape(), wicket: wicketShape, wrapping: giftShape(), anterior: toothShape, chassis: s(armor.pieces, "#5a5a62"), womb: bump("#d98a8a"),
  fetus: bump("#f3c6b0"), organism: bug({ kind: "worm", colour: "#7fae5a" }), blockbuster: bomb, doorstep: slabShape("#bfb3a0"), footing: brickWall(30, 1, "#9a948a"), pragmatic: scroll, knob: s(ball.pieces, "#c9a24a"),
  framing: frameShape, obstruction: s(rock.pieces, "#8e8b80"), rodeo: fence, pedal: pedalShape, doorway: door, driveway: s(road.pieces, "#8a8a8a"), freeway: road,
  antibody: antibodyShape, digestive: s(potion.pieces, "#c9a24a"), formulation: s(potion.pieces, "#5f8ac9"), rinse: s(bottle.pieces, "#7fb4d8"), substrate: s(pile.pieces, "#6b4a2e"), testosterone: s(potion.pieces, "#e9e2d0"),
  botanical: s(potion.pieces, "#7fae5a"), meth: s(crystal.pieces, "#cfeaf2"), preventive: s(bottle.pieces, "#f4f1ea"), fragment: s(pebbles.pieces, "#9a948a"), shaving: s(pile.pieces, "#e6c89a"), calculus: s(pebbles.pieces, "#d9c26a"), tor: torShape,
  cavity: sign(icon.hole()), vale: sign(icon.mountain(), "#fbf6ea", "#7fae5a"), rift: sign(icon.hole(), "#fbf6ea", "#8d877c"), ness: sign(icon.island()), wonderland: sign(icon.star("#d4476a")), graveyard: grave(),
  midfield: s(grass.pieces, "#7fae5a"), savannah: s(grass.pieces, "#d9c26a"), subdivision: house({ w: 38, h: 24, roof: "gable", windows: 2, wall: "#e9e2d0" }), waterfront: sign(icon.wave()), watershed: sign(icon.wave(), "#fbf6ea", "#7fae5a"), lea: s(grass.pieces, "#8ab45a"),
  // Stuff.
  stone: rock, rock, crystal, diamond: s(crystal.pieces, "#cfeaf2"), iron: s(ingot.pieces, "#7d7f80"), steel: s(ingot.pieces, "#b8c2c8"), copper: s(ingot.pieces, "#c9773a"),
  water: puddle, oil: s(puddle.pieces, "#2f2c33"), lava: s(puddle.pieces, "#e0663a"), blood: s(puddle.pieces, "#a8323a"), wood: s([...[[-8, -4], [8, -4], [0, -12]].map(([x, y]) => part(E(x!, y!, 10, 4.5, 12), "body")), ...[[-16, -4], [0, -4], [-8, -12]].map(([x, y]) => dot(E(x! - 1, y!, 3, 3.6, 8), "#e6c89a"))], "#8a6440"),
};

export type { Pt, Silhouette };
export { sym };
