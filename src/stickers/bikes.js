// The bikes a sticker can be shown on (built in BikeScene.js), kept apart
// so the page can list them without loading three.js.
// wheel: outer tyre diameter; tyre: tyre width; r: tube radii (top, down,
// seat); geometry: chainstay, wheelbase, BB drop, stack, reach, head and seat
// tube length and angles. bar: "drop", "flat" or "riser".
export const BIKES = {
  road: { name: "Road", wheel: 672, tyre: 28, r: { top: 16, down: 22, seat: 15 }, cs: 410, wb: 990, drop: 72, stack: 560, reach: 385, ht: 150, hta: 73, st: 530, sta: 73.5, bar: "drop", colour: 0x1d2733 },
  gravel: { name: "Gravel", wheel: 700, tyre: 40, r: { top: 17, down: 23, seat: 15 }, cs: 425, wb: 1030, drop: 72, stack: 585, reach: 380, ht: 160, hta: 71.5, st: 500, sta: 73.5, bar: "drop", colour: 0x55603f },
  mountain: { name: "Mountain", wheel: 750, tyre: 60, r: { top: 22, down: 30, seat: 17 }, cs: 435, wb: 1190, drop: 40, stack: 625, reach: 455, ht: 110, hta: 65, st: 420, sta: 76, bar: "flat", colour: 0xc2410c },
  bmx: { name: "BMX", wheel: 510, tyre: 55, r: { top: 19, down: 21, seat: 15 }, cs: 340, wb: 990, drop: -15, stack: 230, reach: 520, ht: 120, hta: 75, st: 230, sta: 71, bar: "riser", colour: 0x0e7490 },
  kids: { name: "Kids'", wheel: 400, tyre: 50, r: { top: 15, down: 17, seat: 13 }, cs: 300, wb: 760, drop: 20, stack: 400, reach: 300, ht: 100, hta: 70, st: 280, sta: 72, bar: "riser", colour: 0x7c3aed },
  city: { name: "City", wheel: 710, tyre: 45, r: { top: 18, down: 26, seat: 16 }, cs: 450, wb: 1100, drop: 65, stack: 640, reach: 360, ht: 190, hta: 70, st: 470, sta: 72, bar: "flat", colour: 0x334155 },
};

