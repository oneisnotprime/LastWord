/**
 * What each word looks like as a paper standee.
 *
 * `WORDS` (a silhouette for one word) wins over `ARCHETYPES` (one per archetype in
 * data/archetypes.json), which wins over `CLASSES`. To give a word its own look, add it to
 * `WORDS`; anything not listed still gets its archetype's shape, coloured by its own material
 * and colour. See build.ts for the units and the builders.
 */
import {
  band, behind, biped, bird, boat, brickWall, bug, car, dot, dragon, E, eye, fish, flower, glue, house, icon, moved, P, part, plane, quad, R,
  rosette, sign, snake, sym, tank, train, tree, wheel, type Piece, type Pt, type Silhouette,
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
  // Stuff.
  stone: rock, rock, crystal, diamond: s(crystal.pieces, "#cfeaf2"), iron: s(ingot.pieces, "#7d7f80"), steel: s(ingot.pieces, "#b8c2c8"), copper: s(ingot.pieces, "#c9773a"),
  water: puddle, oil: s(puddle.pieces, "#2f2c33"), lava: s(puddle.pieces, "#e0663a"), blood: s(puddle.pieces, "#a8323a"), wood: s([...[[-8, -4], [8, -4], [0, -12]].map(([x, y]) => part(E(x!, y!, 10, 4.5, 12), "body")), ...[[-16, -4], [0, -4], [-8, -12]].map(([x, y]) => dot(E(x! - 1, y!, 3, 3.6, 8), "#e6c89a"))], "#8a6440"),
};

export type { Pt, Silhouette };
export { sym };
