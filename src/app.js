import express from "express";
import path from "node:path";
import apiRouter from "./routes/api.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "30mb" }));
  app.use("/images", express.static(path.resolve(process.cwd(), "images")));
  app.use("/api", apiRouter);
  app.use(express.static(path.resolve(process.cwd(), "public")));

  app.get("/", (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "index.html"));
  });

  return app;
}
