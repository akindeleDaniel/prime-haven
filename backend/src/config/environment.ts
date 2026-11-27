const DEFAULT_PORT = 3001;

export interface Environment {
  port: number;
  appOrigin: string;
  bffSharedSecret: string;
}

export function getEnvironment(): Environment {
  const portValue = process.env.PORT;

  const port = portValue ? Number(portValue) : DEFAULT_PORT;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }

  const origin = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.href !== `${origin.origin}/` || origin.username || origin.password ||
      (origin.protocol !== "https:" && !(process.env.AUTH_ALLOW_LOCAL_HTTP === "true" && local && origin.protocol === "http:"))) {
    throw new Error("APP_ORIGIN must be an exact HTTPS origin (HTTP loopback is development-only).");
  }
  const bffSharedSecret = process.env.BFF_SHARED_SECRET;
  if (!bffSharedSecret || !/^[\x21-\x7e]{32,256}$/.test(bffSharedSecret)) throw new Error("BFF_SHARED_SECRET must have 32-256 printable ASCII bytes without spaces.");
  return { port, appOrigin: origin.origin, bffSharedSecret };
}
