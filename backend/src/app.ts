import express, { type Express } from "express";
import { healthRouter } from "./routes/health.js";
import { getEnvironment, type Environment } from "./config/environment.js";
import { prisma } from "./db/prisma.js";
import { AuthService } from "./auth/service.js";
import { trustedTransport } from "./auth/middleware.js";
import { authRouter } from "./routes/auth.js";
import { ApiError, errorHandler, requestContext } from "./http/errors.js";

export function createApp(config: Pick<Environment, "appOrigin" | "bffSharedSecret"> = getEnvironment(), service = new AuthService(prisma)): Express {
  const app = express();

  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", false);
  app.use(requestContext);
  app.use("/health", healthRouter);
  app.use("/api/v1", trustedTransport(config), express.json({ limit: "8kb", strict: true }), authRouter(service));
  app.use((_request, _response) => { throw new ApiError(404, "NOT_FOUND", "Resource not found."); });
  app.use(errorHandler);

  return app;
}
