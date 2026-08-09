import { createAuth } from "@reel-to-food/auth";
import { env } from "@reel-to-food/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { maps } from "./routes/maps";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));

const routes = app.route("/api/maps", maps).get("/", (c) => c.text("OK"));

export default routes;
export type AppType = typeof routes;
