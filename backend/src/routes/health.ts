import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_request: Request, response: Response) => {
  response.status(200).json({
    status: "ok",
    service: "prime-haven-api",
  });
});
