import cors from "cors";
import express from "express";
import path from "node:path";

import type { ScopedRequest } from "./middlewares/rbac.middleware";
import { authenticate } from "./middlewares/auth.middleware";
import router from "./routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.get("/tokens.css", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "tokens.css"));
});

app.use("/api", (req, res, next) => {
  if (
    req.path === "/health" ||
    req.path === "/auth/login" ||
    req.path === "/auth/password-reset/request" ||
    req.path === "/auth/password-reset/confirm" ||
    req.path.startsWith("/public/")
  ) {
    return next();
  }

  return authenticate(req, res, next);
});
// Answer keys stay on the server, including nested assessment configurations in API responses.
app.use("/api", (req: ScopedRequest, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (req.user?.role === "peserta" && body !== undefined) {
      body = JSON.parse(JSON.stringify(body, (key, value) => {
        if (key === "questions" && Array.isArray(value)) return value.map(question => {
          if (!question || typeof question !== "object") return question;
          const { correct_answer, explanation, ...visible } = question;
          return visible;
        });
        return value;
      }));
    }
    return sendJson(body);
  };
  next();
});
app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

export default app;
