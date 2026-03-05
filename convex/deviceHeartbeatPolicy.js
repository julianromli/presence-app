export const DEVICE_HEARTBEAT_MAX_AGE_MS = 60_000;

export function isDeviceHeartbeatFresh(heartbeat, now = Date.now()) {
  if (!heartbeat?.lastSeenAt) {
    return false;
  }

  return now - heartbeat.lastSeenAt <= DEVICE_HEARTBEAT_MAX_AGE_MS;
}
