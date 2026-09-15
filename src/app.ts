import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "node:path";

import type { ScopedRequest } from "./middlewares/rbac.middleware";
import { authenticate } from "./middlewares/auth.middleware";
import router from "./routes";

const app = express();

const defaultAllowedOrigins = [
  "https://lms-brighted.ezitech.online",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function getAllowedOrigins() {
  return (process.env.CORS_ORIGINS ?? process.env.PUBLIC_APP_URL ?? defaultAllowedOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "connect-src": ["'self'"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "frame-ancestors": ["'none'"],
        "frame-src": ["'self'", "blob:"],
        "img-src": ["'self'", "data:", "blob:"],
        "media-src": ["'self'", "blob:"],
        "object-src": ["'none'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        "upgrade-insecure-requests": [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: false,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      return callback(null, getAllowedOrigins().includes(origin));
    },
    credentials: false,
  }),
);

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan. Silakan coba lagi beberapa menit lagi.",
  },
});

app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/password-reset/request", authRateLimit);
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

