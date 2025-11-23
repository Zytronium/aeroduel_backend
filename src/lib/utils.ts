import { randomBytes } from "crypto";
import { networkInterfaces } from "os";

// Generate 6-digit game PIN
export function generateGamePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
  // todo: avoid ID collisions
}

// Generate unique match ID
export function generateMatchId(): string {
  return randomBytes(16).toString("hex");
  // todo: avoid ID collisions
}

// Get local IP address
export function getLocalIpAddress(): string | null {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo)
      continue; // skip

    for (const net of netInfo) {
      // Skip internal (loopback) and non-IPv4 addresses
      const isIPv4 = net.family === "IPv4";
      const isInternal = net.internal;

      if (isIPv4 && !isInternal) {
        return net.address;
      }
    }
  }

  return null;
}
