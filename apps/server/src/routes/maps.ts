import { zValidator } from "@hono/zod-validator";
import { createDb } from "@reel-to-food/db";
import { map } from "@reel-to-food/db/schema/map";
import { mapMember } from "@reel-to-food/db/schema/map-member";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { authMiddleware } from "../../middlewares/auth.middleware";
import { memberMiddleware } from "../../middlewares/member.middleware";
import { ownerMiddleware } from "../../middlewares/owner.middleware";
import type { AppEnv } from "../types";

const db = createDb();

const createMapSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const updateMapSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const addMemberSchema = z.object({
  email: z.email(),
});

export const maps = new Hono<AppEnv>();

maps.use("*", authMiddleware);

// Create a map and add the current user as owner
maps.post("/", zValidator("json", createMapSchema), async (c) => {
  const { name } = c.req.valid("json");
  const currentUser = c.get("user");
  const mapId = crypto.randomUUID();

  await db.batch([
    db.insert(map).values({
      id: mapId,
      name,
      ownerId: currentUser.id,
    }),
    db.insert(mapMember).values({
      mapId,
      userId: currentUser.id,
      role: "owner",
    }),
  ]);

  const created = await db.query.map.findFirst({
    where: (mapsTable, { eq }) => eq(mapsTable.id, mapId),
  });

  return c.json({ map: created }, 201);
});

// List maps the current user is a member of
maps.get("/", async (c) => {
  const currentUser = c.get("user");

  const memberships = await db.query.mapMember.findMany({
    where: (members, { eq }) => eq(members.userId, currentUser.id),
    with: {
      map: true,
    },
  });

  return c.json({
    maps: memberships.map((membership) => ({
      ...membership.map,
      role: membership.role,
    })),
  });
});

// List members of a map
maps.get("/:mapId/members", memberMiddleware, async (c) => {
  const mapId = c.get("mapId");

  const members = await db.query.mapMember.findMany({
    where: (memberships, { eq }) => eq(memberships.mapId, mapId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return c.json({ members });
});

// Add a member to a map by exact account email (owner only)
maps.post(
  "/:mapId/members",
  ownerMiddleware,
  zValidator("json", addMemberSchema),
  async (c) => {
    const mapId = c.get("mapId");
    const { email } = c.req.valid("json");

    const account = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (!account) {
      return c.json({ error: "No account found for this email", email }, 404);
    }

    const existing = await db.query.mapMember.findFirst({
      where: (members, { and, eq }) =>
        and(eq(members.mapId, mapId), eq(members.userId, account.id)),
    });

    if (existing) {
      return c.json({ error: "User is already a member of this map" }, 409);
    }

    await db.insert(mapMember).values({
      mapId,
      userId: account.id,
      role: "member",
    });

    return c.json(null, 201);
  },
);

// Remove a member from a map (owner only)
maps.delete("/:mapId/members/:userId", ownerMiddleware, async (c) => {
  const mapId = c.get("mapId");
  const userId = c.req.param("userId");

  const membership = await db.query.mapMember.findFirst({
    where: (members, { and, eq }) =>
      and(eq(members.mapId, mapId), eq(members.userId, userId)),
  });

  if (!membership) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (membership.role === "owner") {
    return c.json({ error: "Cannot remove the map owner" }, 400);
  }

  const [removed] = await db
    .delete(mapMember)
    .where(and(eq(mapMember.mapId, mapId), eq(mapMember.userId, userId)))
    .returning();

  return c.json({ member: removed });
});

// Get a single map by id
maps.get("/:mapId", memberMiddleware, async (c) => {
  const mapId = c.get("mapId");

  const found = await db.query.map.findFirst({
    where: (mapsTable, { eq }) => eq(mapsTable.id, mapId),
  });

  if (!found) {
    return c.json({ error: "Map not found" }, 404);
  }

  return c.json({ map: found, member: c.get("member") });
});

// Update a map name
maps.patch(
  "/:mapId",
  memberMiddleware,
  zValidator("json", updateMapSchema),
  async (c) => {
    const mapId = c.get("mapId");
    const { name } = c.req.valid("json");

    const [updated] = await db
      .update(map)
      .set({ name })
      .where(eq(map.id, mapId))
      .returning();

    if (!updated) {
      return c.json({ error: "Map not found" }, 404);
    }

    return c.json({ map: updated });
  },
);

// Delete a map (owner only)
maps.delete("/:mapId", ownerMiddleware, async (c) => {
  const mapId = c.get("mapId");

  const [deleted] = await db.delete(map).where(eq(map.id, mapId)).returning();

  if (!deleted) {
    return c.json({ error: "Map not found" }, 404);
  }

  return c.json({ map: deleted });
});
