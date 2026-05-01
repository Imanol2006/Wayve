// Web Bluetooth wrapper for the BlindCane peripheral.
//
// Connects to the Arduino sketch defined in the firmware: a single GATT
// service exposing a write-only command characteristic ('L'/'R'/'N'/'B')
// and an optional notify characteristic carrying obstacle distance in cm.
//
// The Arduino sketch reverts servos to neutral after IDLE_TIMEOUT_MS = 3s
// of silence, so we run a 1Hz heartbeat that re-sends the last command.

import { BLE, BLE_HEARTBEAT_MS } from "../config.js";

let device = null;
let server = null;
let commandChar = null;
let obstacleChar = null;
let lastCommand = null;
let heartbeatTimer = null;

const listeners = {
  status: new Set(),
  obstacle: new Set(),
};

function emit(event, payload) {
  listeners[event].forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.warn(`bluetooth listener for "${event}" threw:`, err);
    }
  });
}

export function isSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export function isConnected() {
  return !!server && server.connected;
}

export async function connect() {
  if (!isSupported()) {
    throw new Error(
      "Web Bluetooth not available. Use Chrome/Edge over HTTPS or localhost."
    );
  }

  device = await navigator.bluetooth.requestDevice({
    filters: [{ name: BLE.DEVICE_NAME }],
    optionalServices: [BLE.SERVICE_UUID],
  });

  device.addEventListener("gattserverdisconnected", handleDisconnect);

  server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLE.SERVICE_UUID);

  commandChar = await service.getCharacteristic(BLE.COMMAND_UUID);

  // Obstacle char is optional — firmware may not have it yet (Phase 2).
  try {
    obstacleChar = await service.getCharacteristic(BLE.OBSTACLE_UUID);
    await obstacleChar.startNotifications();
    obstacleChar.addEventListener(
      "characteristicvaluechanged",
      handleObstacleEvent
    );
  } catch (_e) {
    obstacleChar = null;
  }

  // Send neutral immediately so the Arduino has something to heartbeat.
  await sendCommand("N");
  startHeartbeat();
  emit("status", { connected: true, deviceName: device.name ?? null });
  return true;
}

export function disconnect() {
  stopHeartbeat();
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  } else {
    handleDisconnect();
  }
}

function handleDisconnect() {
  stopHeartbeat();
  commandChar = null;
  obstacleChar = null;
  server = null;
  emit("status", { connected: false, deviceName: null });
}

function handleObstacleEvent(event) {
  const view = event.target.value;
  if (!view || view.byteLength === 0) return;
  const distanceCm = view.getUint8(0);
  emit("obstacle", { distanceCm });
}

async function writeByte(cmd) {
  if (!commandChar) return;
  await commandChar.writeValue(new TextEncoder().encode(cmd));
}

export async function sendCommand(cmd) {
  if (!commandChar) return;
  const c = String(cmd).toUpperCase();
  if (!"LRNB".includes(c)) {
    console.warn(`bluetooth.sendCommand: ignoring unknown cue "${cmd}"`);
    return;
  }
  lastCommand = c;
  try {
    await writeByte(c);
  } catch (err) {
    console.warn("BLE write failed:", err.message);
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!commandChar || !lastCommand) return;
    writeByte(lastCommand).catch(() => {});
  }, BLE_HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

export function onStatusChange(fn) {
  listeners.status.add(fn);
  return () => listeners.status.delete(fn);
}

export function onObstacle(fn) {
  listeners.obstacle.add(fn);
  return () => listeners.obstacle.delete(fn);
}

export function getDeviceName() {
  return device?.name ?? null;
}
