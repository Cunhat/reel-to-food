import { createAuth } from "@reel-to-food/auth";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../src/types";

const auth = createAuth();

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});
