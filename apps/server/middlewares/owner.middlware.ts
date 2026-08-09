import { createMiddleware } from "hono/factory";
import { createDb } from "@reel-to-food/db";

const db = createDb();

export const ownerMiddleware = createMiddleware(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const mapId = c.req.param("mapId");
  if (!mapId) {
    return c.json({ error: "mapId is required" }, 400);
  }

  const owner = await db.query.map.findFirst({
    where: (map, { and, eq }) =>
      and(eq(map.id, mapId), eq(map.ownerId, user.id)),
  });

  if (!owner) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return next();
});
