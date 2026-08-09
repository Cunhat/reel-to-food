import { createDb } from "@reel-to-food/db";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../src/types";

const db = createDb();

export const ownerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const mapId = c.req.param("mapId");
  if (!mapId) {
    return c.json({ error: "mapId is required" }, 400);
  }

  const ownedMap = await db.query.map.findFirst({
    where: (map, { and, eq }) => and(eq(map.id, mapId), eq(map.ownerId, user.id)),
  });

  if (!ownedMap) {
    return c.json({ error: "Forbidden" }, 403);
  }

  c.set("mapId", mapId);
  return next();
});
