// YouTube Shorts shown in the "From the shop" strip on the home page, newest
// first. `id` is the part after youtube.com/shorts/; `title` is what the card
// says (it can be tidier than the YouTube title). Add new ones to the top.
// A model on the 3D models page shows its Short via `video` in
// src/models/catalog.js instead.
export const CHANNEL = "https://www.youtube.com/@tom-sp1sx";

export const shorts = [
  { id: "ipLZ30KxH4c", title: "Predator: Badlands mask" },
  { id: "nS6CeKRe7JM", title: "The Grinch mask took three tries" },
  { id: "nSBOuU-zwmc", title: "Excavator bucket key holder", model: "keyholders-bucket" },
  { id: "NFMzslxjwwE", title: "Multi-colour dragon" },
  { id: "JpV0V6Sdtjk", title: "Organizer bins" },
  { id: "EAl-NNmS9rc", title: "Printing a mask" },
  { id: "FoYFKZH9W04", title: "3D model of Vancouver" },
  { id: "obxxWblI7rY", title: "Gridfinity bins" },
];

export const shortUrl = (id) => `https://www.youtube.com/shorts/${id}`;
// YouTube's tall (9:16) thumbnail for a Short.
export const shortThumb = (id) => `https://i.ytimg.com/vi/${id}/oar2.jpg`;
