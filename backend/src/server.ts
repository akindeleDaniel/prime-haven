import "dotenv/config";
import { createApp } from "./app.js";
import { getEnvironment } from "./config/environment.js";

try {
  const environment = getEnvironment();
  const app = createApp();
  const server = app.listen(environment.port, () => {
    console.log(`Prime Haven API listening on http://localhost:${environment.port}`);
  });

  server.on("error", (error) => {
    console.error("Failed to start the Prime Haven API:", error.message);
    process.exitCode = 1;
  });
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Failed to start the Prime Haven API: ${message}`);
  process.exitCode = 1;
}
