import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeadersMiddleware } from "./middleware/security-headers-middleware";
import { generalRateLimit } from "./middleware/rate-limit-middleware";
import { resolveAuth } from "./middleware/auth-middleware";
import { resolveTenant } from "./middleware/tenant-middleware";

const app: Express = express();

// Security headers — applied before all routes
app.use(securityHeadersMiddleware);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: process.env["CORS_ORIGIN"] ?? true,
  credentials: true,
}));
// Raw body for Stripe webhook — must be before express.json()
app.use("/api/v1/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// General rate limiting on all API routes
app.use("/api", generalRateLimit);

// Resolve auth context (non-blocking — populates req.auth when credentials present)
app.use("/api", resolveAuth);

// Resolve tenant context (non-blocking — populates req.tenant when org header present)
app.use("/api", resolveTenant);

app.use("/api", router);

export default app;
