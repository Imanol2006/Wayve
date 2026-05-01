/*
 * Assistive Cane: BLE Receiver + Obstacle Notifier
 * Target board: Arduino Uno R4 WiFi
 *
 * BLE peripheral exposing one service with two characteristics:
 *   - Command (write):  iPhone/Android writes 'L' / 'R' / 'N' / 'B' bytes
 *   - Obstacle (notify): pushes ultrasonic distance (cm, uint8) to the
 *                        central whenever an obstacle is within range
 *
 * Command byte protocol:
 *   'L' / 'l'  : activate LEFT servo  (turn left cue)
 *   'R' / 'r'  : activate RIGHT servo (turn right cue)
 *   'N' / 'n'  : both servos neutral  (on path / no cue)
 *   'B' / 'b'  : both servos active   (arrival, alert, or "stop")
 *
 * Safety:
 *   On disconnect, both servos return to neutral.
 *   If no command arrives for IDLE_TIMEOUT_MS, both servos return to neutral.
 *
 * Required library (install via Arduino IDE Library Manager):
 *   ArduinoBLE  by Arduino
 */

#include <ArduinoBLE.h>
#include <Servo.h>

// =============================================================
//   HARDWARE CONFIG
// =============================================================
const uint8_t LEFT_SERVO_PIN  = 9;
const uint8_t RIGHT_SERVO_PIN = 10;

// HC-SR04 (or compatible) ultrasonic sensor
const uint8_t TRIG_PIN = 7;
const uint8_t ECHO_PIN = 8;

// Tune these to your physical mount.
const uint8_t SERVO_NEUTRAL = 90;
const uint8_t SERVO_ACTIVE  = 45;

// Failsafe: if no command arrives for this long, return to neutral.
const unsigned long IDLE_TIMEOUT_MS = 3000;

// Obstacle reporting
const unsigned long OBSTACLE_POLL_MS    = 100;  // how often we ping the sensor
const uint16_t      OBSTACLE_ALERT_CM   = 100;  // <= this distance triggers a notify
const unsigned long OBSTACLE_NOTIFY_MIN = 200;  // dedupe: ms between identical notifies

// =============================================================
//   BLE UUIDs (must match the webapp's src/config.js)
// =============================================================
#define SERVICE_UUID  "19B10000-E8F2-537E-4F6C-D104768A1214"
#define COMMAND_UUID  "19B10001-E8F2-537E-4F6C-D104768A1214"
#define OBSTACLE_UUID "19B10002-E8F2-537E-4F6C-D104768A1214"

BLEService canService(SERVICE_UUID);

BLEByteCharacteristic commandChar(
  COMMAND_UUID,
  BLERead | BLEWrite | BLEWriteWithoutResponse
);

BLEByteCharacteristic obstacleChar(
  OBSTACLE_UUID,
  BLERead | BLENotify
);

// =============================================================
//   GLOBAL STATE
// =============================================================
Servo leftServo;
Servo rightServo;
unsigned long lastCommandTime  = 0;
unsigned long lastObstaclePoll = 0;
unsigned long lastObstacleSent = 0;
uint8_t       lastObstacleVal  = 255;

// =============================================================
//   SETUP
// =============================================================
void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  leftServo.attach(LEFT_SERVO_PIN);
  rightServo.attach(RIGHT_SERVO_PIN);
  setServos(false, false);

  if (!BLE.begin()) {
    Serial.println(F("BLE init failed. Halting."));
    while (1);
  }

  BLE.setLocalName("BlindCane");
  BLE.setDeviceName("BlindCane");
  BLE.setAdvertisedService(canService);

  canService.addCharacteristic(commandChar);
  canService.addCharacteristic(obstacleChar);
  BLE.addService(canService);

  commandChar.writeValue((uint8_t)'N');     // initial state
  obstacleChar.writeValue((uint8_t)255);    // 255 = "no obstacle in range"
  BLE.advertise();

  Serial.println(F("BLE peripheral 'BlindCane' advertising."));
}

// =============================================================
//   MAIN LOOP
// =============================================================
void loop() {
  BLEDevice central = BLE.central();

  if (!central) return;

  Serial.print(F("Central connected: "));
  Serial.println(central.address());
  lastCommandTime = millis();

  while (central.connected()) {
    if (commandChar.written()) {
      byte cmd = commandChar.value();
      handleCommand(cmd);
      lastCommandTime = millis();
    }

    // Failsafe: idle timeout returns servos to neutral
    if (millis() - lastCommandTime > IDLE_TIMEOUT_MS) {
      setServos(false, false);
    }

    // Periodically poll the ultrasonic sensor and notify if close
    if (millis() - lastObstaclePoll > OBSTACLE_POLL_MS) {
      lastObstaclePoll = millis();
      pollObstacle();
    }
  }

  Serial.println(F("Central disconnected. Servos neutral."));
  setServos(false, false);
}

// =============================================================
//   COMMAND HANDLING
// =============================================================
void handleCommand(byte cmd) {
  if (cmd >= 'a' && cmd <= 'z') cmd -= 32;

  switch (cmd) {
    case 'L':
      setServos(true, false);
      Serial.println(F("LEFT cue"));
      break;
    case 'R':
      setServos(false, true);
      Serial.println(F("RIGHT cue"));
      break;
    case 'N':
      setServos(false, false);
      Serial.println(F("Neutral"));
      break;
    case 'B':
      setServos(true, true);
      Serial.println(F("BOTH (alert / arrival)"));
      break;
    default:
      Serial.print(F("Unknown command: 0x"));
      Serial.println(cmd, HEX);
      break;
  }
}

// =============================================================
//   SERVO ACTUATION
// =============================================================
void setServos(bool leftActive, bool rightActive) {
  leftServo.write(leftActive   ? SERVO_ACTIVE : SERVO_NEUTRAL);
  rightServo.write(rightActive ? SERVO_ACTIVE : SERVO_NEUTRAL);
}

// =============================================================
//   OBSTACLE SENSOR (HC-SR04)
// =============================================================
void pollObstacle() {
  // Trigger a 10us pulse
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Echo: time-of-flight in microseconds, capped to ~30ms (~5m round trip).
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) {
    // No echo → treat as out-of-range
    maybeNotifyObstacle(255);
    return;
  }

  // Speed of sound ≈ 0.0343 cm/us; round trip → /2.
  uint16_t distCm = (uint16_t)(duration * 0.0343 / 2.0);
  if (distCm > 254) distCm = 255;  // saturate

  if (distCm <= OBSTACLE_ALERT_CM) {
    maybeNotifyObstacle((uint8_t)distCm);
  } else {
    maybeNotifyObstacle(255);
  }
}

void maybeNotifyObstacle(uint8_t distCm) {
  unsigned long now = millis();
  // Avoid spamming: only notify if value changed OR enough time has passed.
  if (distCm == lastObstacleVal && (now - lastObstacleSent) < 1000) return;
  if ((now - lastObstacleSent) < OBSTACLE_NOTIFY_MIN) return;

  obstacleChar.writeValue(distCm);
  lastObstacleVal  = distCm;
  lastObstacleSent = now;
}
