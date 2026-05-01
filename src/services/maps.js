// Google Maps Platform — JS SDK loader + thin wrappers.
//
// Uses the Maps JS API (script-tag injection) so DirectionsService,
// Geocoder, and Places work without CORS issues. Loads "places" and
// "geometry" libraries — we'll need them for autocomplete and bearing
// math in the navigation engine.

import { GOOGLE_MAPS_API_KEY } from "../config.js";

let loadPromise = null;

function loadGoogleMaps() {
  if (loadPromise) return loadPromise;

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error(
        "Missing VITE_GOOGLE_MAPS_KEY in .env.local — the Maps SDK cannot load."
      )
    );
  }

  if (typeof window !== "undefined" && window.google?.maps) {
    loadPromise = Promise.resolve(window.google.maps);
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "__wayveMapsCallback__";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&libraries=places,geometry` +
      `&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps SDK"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function ensureLoaded() {
  await loadGoogleMaps();
}

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

export async function geocode(query, { biasNear = null } = {}) {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();

  const request = { address: query };
  if (biasNear) {
    // Bias results toward the user's current area (10km radius).
    request.bounds = new maps.LatLngBounds(
      new maps.LatLng(biasNear.lat - 0.1, biasNear.lng - 0.1),
      new maps.LatLng(biasNear.lat + 0.1, biasNear.lng + 0.1)
    );
  }

  const { results } = await geocoder.geocode(request);
  if (!results?.length) {
    throw new Error(`No geocoding results for "${query}"`);
  }
  const top = results[0];
  return {
    name: query,
    address: top.formatted_address,
    lat: top.geometry.location.lat(),
    lng: top.geometry.location.lng(),
    placeId: top.place_id ?? null,
  };
}

export function getCurrentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(`Geolocation: ${err.message}`)),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

export async function getWalkingRoute(origin, destination) {
  const maps = await loadGoogleMaps();
  const service = new maps.DirectionsService();

  const result = await service.route({
    origin:
      typeof origin === "string"
        ? origin
        : new maps.LatLng(origin.lat, origin.lng),
    destination:
      typeof destination === "string"
        ? destination
        : new maps.LatLng(destination.lat, destination.lng),
    travelMode: maps.TravelMode.WALKING,
  });

  const route = result.routes?.[0];
  if (!route) throw new Error("No walking route found");
  const leg = route.legs?.[0];
  if (!leg) throw new Error("No leg in route");

  return {
    summary: route.summary,
    distanceMeters: leg.distance.value,
    distanceText: leg.distance.text,
    durationSeconds: leg.duration.value,
    durationText: leg.duration.text,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    overviewPolyline: route.overview_polyline,
    steps: leg.steps.map((s) => ({
      instruction: stripHtml(s.instructions),
      maneuver: s.maneuver ?? "straight",
      distanceMeters: s.distance.value,
      distanceText: s.distance.text,
      start: { lat: s.start_location.lat(), lng: s.start_location.lng() },
      end: { lat: s.end_location.lat(), lng: s.end_location.lng() },
      polyline: s.polyline?.points ?? null,
    })),
  };
}
