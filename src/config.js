// Tuneable thresholds and constants for Wayve.
// One place to change them when tuning the demo.

export const NUDGE_DISTANCE_M = 5;
export const TTS_PREVIEW_DISTANCES_M = [50, 20, 5];
export const ARRIVAL_RADIUS_M = 8;
export const OFF_ROUTE_RADIUS_M = 15;
export const BLE_HEARTBEAT_MS = 1000;
export const OBSTACLE_ALERT_RANGE_CM = 100;
export const REROUTE_DEBOUNCE_MS = 5000;

// Web Bluetooth requires lowercase UUIDs. The Arduino sketch
// declares them uppercase but the BT layer normalises.
export const BLE = {
  SERVICE_UUID: "19b10000-e8f2-537e-4f6c-d104768a1214",
  COMMAND_UUID: "19b10001-e8f2-537e-4f6c-d104768a1214",
  OBSTACLE_UUID: "19b10002-e8f2-537e-4f6c-d104768a1214",
  DEVICE_NAME: "BlindCane",
};

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
