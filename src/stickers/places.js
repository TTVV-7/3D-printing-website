// Addresses and bike routes for the route sticker, from free OpenStreetMap
// services that need no key (fine for a first version; switch to a keyed
// service such as OpenRouteService before heavy use):
//
// - Photon (photon.komoot.io): address search as you type
// - OSRM's bike router (routing.openstreetmap.de): the route between stops
//
// Map data © OpenStreetMap contributors (ODbL): the page credits it.

const PHOTON = "https://photon.komoot.io/api/";
const OSRM = "https://routing.openstreetmap.de/routed-bike/route/v1/driving/";
const NEAR = { lat: 49.28, lon: -123.12 }; // results near Vancouver first

// Places matching `q`: [{ label, sub, short, lon, lat }]. `short` is what
// goes on the sticker: the place's name, or its street, or its town.
export async function searchPlaces(q, signal) {
  const url = `${PHOTON}?${new URLSearchParams({ q, limit: 6, lang: "en", lat: NEAR.lat, lon: NEAR.lon })}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const { features } = await res.json();
  return features.map(({ properties: p, geometry }) => {
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const label = p.name || street || p.city || p.state;
    const sub = [p.name && street, p.city !== label && p.city, p.state, p.country].filter(Boolean).join(", ");
    const [lon, lat] = geometry.coordinates;
    return { label, sub, short: p.name || p.city || street, lon, lat };
  });
}

// The bike route through `stops` ([{ lon, lat }], two or more):
// { coords: [[lon, lat], ...], km }.
export async function bikeRoute(stops, signal) {
  const path = stops.map((s) => `${s.lon.toFixed(6)},${s.lat.toFixed(6)}`).join(";");
  const res = await fetch(`${OSRM}${path}?overview=full&geometries=geojson`, { signal });
  // A 400 is the router saying it can't get there by bike (another
  // continent, an island with no bridge).
  const data = res.ok || res.status === 400 ? await res.json().catch(() => ({})) : {};
  if (!res.ok && res.status !== 400) throw new Error(`The route service didn't answer (${res.status}). Try again in a moment.`);
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No bike route between those places. Check each one is the place you meant.");
  const [route] = data.routes;
  return { coords: route.geometry.coordinates, km: route.distance / 1000 };
}

// The same trip in Google Maps, by bike (no key needed for a link).
export function googleMapsLink(stops) {
  const at = (s) => `${s.lat},${s.lon}`;
  const q = { api: 1, origin: at(stops[0]), destination: at(stops[stops.length - 1]), travelmode: "bicycling" };
  if (stops.length > 2) q.waypoints = stops.slice(1, -1).map(at).join("|");
  return `https://www.google.com/maps/dir/?${new URLSearchParams(q)}`;
}
