// The real bike models full-colour bike stickers are shown on
// (BikeModelScene.js; the thermal Bike tab builds its own, bikes.js). The models are
// built by scripts/bike-models.mjs: real size in metres, front wheel along
// +x, standing on y = 0, and the frame in one material called "paint".
//
// Each tube is a rough centre line seen from the side, [x, y] in metres from
// the back of the tube to the front. It only needs to be inside the tube:
// BikeModelScene.js finds the real centre and surface from the model.

export const BIKE_MODELS = [
  {
    key: "road",
    name: "Road",
    url: "/models/bikes/road.glb",
    tubes: {
      top: [[-0.2, 0.722], [0.289, 0.811]],
      down: [[-0.067, 0.389], [0.311, 0.711]],
    },
    credit: { title: "Road Bike", author: "tanity", url: "https://sketchfab.com/3d-models/road-bike-cb03b0657fbc4693b59194124ba713db" },
  },
  {
    key: "mountain",
    name: "Mountain",
    url: "/models/bikes/mountain.glb",
    tubes: {
      top: [[-0.233, 0.707], [0.3, 0.871]],
      down: [[-0.122, 0.367], [0.311, 0.811]],
    },
    credit: { title: "MTB Mongoose Tyax", author: "Saushkin", url: "https://sketchfab.com/3d-models/mtb-mongoose-tyax-d5c7ab157aa84eb08e2deaee6165e764" },
  },
  {
    key: "city",
    name: "City",
    url: "/models/bikes/city.glb",
    // A step-through: its low top tube is curved, so stickers go on the down tube.
    tubes: {
      down: [[-0.067, 0.4], [0.344, 0.789]],
    },
    credit: { title: "Dutch Bicycle", author: "Fairyflosslord7", url: "https://sketchfab.com/3d-models/dutch-bicycle-1967bfe65c164c589351985e7becc8b8" },
  },
];

export const bikeOf = (key) => BIKE_MODELS.find((b) => b.key === key) || BIKE_MODELS[0];

export const TUBES = { top: "Top tube", down: "Down tube" };

// Frame colours to try the sticker against.
export const PAINTS = [
  ["#c8102e", "Red"],
  ["#111317", "Black"],
  ["#f2f2ef", "White"],
  ["#1f4f8f", "Blue"],
  ["#2f6b4f", "Green"],
  ["#9aa1ab", "Raw alloy"],
  ["#f2c230", "Yellow"],
];
