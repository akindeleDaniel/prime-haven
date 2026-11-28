import express, { type Express } from "express";
import { healthRouter } from "./routes/health.js";
import { getEnvironment, type Environment } from "./config/environment.js";
import { prisma } from "./db/prisma.js";
import { AuthService } from "./auth/service.js";
import { trustedTransport } from "./auth/middleware.js";
import { authRouter } from "./routes/auth.js";
import { ApiError, errorHandler, requestContext } from "./http/errors.js";
import { PropertyService } from "./properties/service.js";
import { propertyRouter } from "./routes/properties.js";
import { ImageService } from "./images/service.js";
import { CloudinaryHttpProvider } from "./images/cloudinary.js";
import { imageRouter } from "./routes/images.js";

export function createApp(config: Pick<Environment, "appOrigin" | "bffSharedSecret"> = getEnvironment(), service = new AuthService(prisma), properties = new PropertyService(prisma),
  images = new ImageService(prisma, new CloudinaryHttpProvider(), config.bffSharedSecret)): Express {
  const app = express();

  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", false);
  app.use(requestContext);
  app.use("/health", healthRouter);
  const authJson = express.json({ limit: "8kb", strict: true });
  const propertyJson = express.json({ limit: "32kb", strict: true });
  app.use("/api/v1", trustedTransport(config), (request, response, next) => {
    const parse = request.path === "/agent/properties" || request.path.startsWith("/agent/properties/") || request.path === "/admin/properties" || request.path.startsWith("/admin/properties/") || request.path.startsWith("/properties/") ? propertyJson : authJson;
    parse(request, response, next);
  }, imageRouter(service, images), propertyRouter(service, properties), authRouter(service));
  app.use((_request, _response) => { throw new ApiError(404, "NOT_FOUND", "Resource not found."); });
  app.use(errorHandler);

  return app;
}
