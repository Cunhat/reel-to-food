import { createDb } from "@reel-to-food/db";
import { createMiddleware } from "hono/factory";

const db = createDb();

export const memberMiddleware = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const mapId = c.req.param("mapId");
  if (!mapId) {
    return c.json({ error: "mapId is required" }, 400);
  }

  const membership = await db.query.mapMember.findFirst({
    where: (members, { and, eq }) =>
      and(eq(members.mapId, mapId), eq(members.userId, user.id)),
  });

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  c.set("mapId", mapId);
  c.set("member", membership);
  return next();
});
