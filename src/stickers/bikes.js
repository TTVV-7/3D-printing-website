// The bikes a sticker can be shown on (real models, realBike.js; the built
// ones in BikeScene.js show while they load), kept apart so the page can
// list them without loading three.js.
// wheel: outer tyre diameter; tyre: tyre width; r: tube radii (top, down,
// seat); geometry: chainstay, wheelbase, BB drop, stack, reach, head and seat
// tube length and angles. bar: "drop" or "flat".
export const BIKES = {
  road: { name: "Road", wheel: 672, tyre: 28, r: { top: 16, down: 22, seat: 15 }, cs: 410, wb: 990, drop: 72, stack: 560, reach: 385, ht: 150, hta: 73, st: 530, sta: 73.5, bar: "drop", colour: 0x1d2733 },
  mountain: { name: "Mountain", wheel: 750, tyre: 60, r: { top: 22, down: 30, seat: 17 }, cs: 435, wb: 1190, drop: 40, stack: 625, reach: 455, ht: 110, hta: 65, st: 420, sta: 76, bar: "flat", colour: 0xc2410c },
  city: { name: "City", wheel: 710, tyre: 45, r: { top: 18, down: 26, seat: 16 }, cs: 450, wb: 1100, drop: 65, stack: 640, reach: 360, ht: 190, hta: 70, st: 470, sta: 72, bar: "flat", colour: 0x334155 },
};

