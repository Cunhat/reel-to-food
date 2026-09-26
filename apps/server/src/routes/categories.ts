import { zValidator } from "@hono/zod-validator";
import { createDb } from "@reel-to-food/db";
import { category } from "@reel-to-food/db/schema/category";
import { placeCategory } from "@reel-to-food/db/schema/place-category";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { memberMiddleware } from "../../middlewares/member.middleware";
import type { AppEnv } from "../types";

const db = createDb();

const categoryNameSchema = z.object({
  name: z.string().trim().min(1).max(50),
});

// Case-insensitive lookup so "Pizza" and "pizza" can't coexist in the same map
async function findCategoryByName(mapId: string, name: string, excludeId?: string) {
  return db.query.category.findFirst({
    where: (categoriesTable, { and, eq }) =>
      and(
        eq(categoriesTable.mapId, mapId),
        sql`lower(${categoriesTable.name}) = lower(${name})`,
        excludeId ? ne(categoriesTable.id, excludeId) : undefined,
      ),
  });
}

// Mounted under /api/maps/:mapId/categories; categories are a shared
// taxonomy, so every map member can read and mutate them
export const categories = new Hono<AppEnv>();

categories.use("*", memberMiddleware);

// List categories of a map with how many places use each one
categories.get("/", async (c) => {
  const mapId = c.get("mapId");

  const rows = await db
    .select({
      id: category.id,
      mapId: category.mapId,
      name: category.name,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      placeCount: count(placeCategory.id),
    })
    .from(category)
    .leftJoin(placeCategory, eq(placeCategory.categoryId, category.id))
    .where(eq(category.mapId, mapId))
    .groupBy(category.id)
    .orderBy(asc(sql`lower(${category.name})`));

  return c.json({ categories: rows });
});

// Create a category
categories.post("/", zValidator("json", categoryNameSchema), async (c) => {
  const mapId = c.get("mapId");
  const { name } = c.req.valid("json");

  if (await findCategoryByName(mapId, name)) {
    return c.json({ error: "A category with this name already exists" }, 409);
  }

  const [created] = await db.insert(category).values({ mapId, name }).returning();

  return c.json({ category: created }, 201);
});

// Get a single category
categories.get("/:categoryId", async (c) => {
  const mapId = c.get("mapId");
  const categoryId = c.req.param("categoryId");

  const found = await db.query.category.findFirst({
    where: (categoriesTable, { and, eq }) =>
      and(eq(categoriesTable.id, categoryId), eq(categoriesTable.mapId, mapId)),
  });

  if (!found) {
    return c.json({ error: "Category not found" }, 404);
  }

  return c.json({ category: found });
});

// Rename a category
categories.patch("/:categoryId", zValidator("json", categoryNameSchema), async (c) => {
  const mapId = c.get("mapId");
  const categoryId = c.req.param("categoryId");
  const { name } = c.req.valid("json");

  if (await findCategoryByName(mapId, name, categoryId)) {
    return c.json({ error: "A category with this name already exists" }, 409);
  }

  const [updated] = await db
    .update(category)
    .set({ name })
    .where(and(eq(category.id, categoryId), eq(category.mapId, mapId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Category not found" }, 404);
  }

  return c.json({ category: updated });
});

// Delete a category. Places are kept; they are only unlinked from it
categories.delete("/:categoryId", async (c) => {
  const mapId = c.get("mapId");
  const categoryId = c.req.param("categoryId");

  const found = await db.query.category.findFirst({
    where: (categoriesTable, { and, eq }) =>
      and(eq(categoriesTable.id, categoryId), eq(categoriesTable.mapId, mapId)),
  });

  if (!found) {
    return c.json({ error: "Category not found" }, 404);
  }

  // Unlink explicitly rather than relying on the FK cascade being enforced
  const [unlinked, deleted] = await db.batch([
    db
      .delete(placeCategory)
      .where(eq(placeCategory.categoryId, categoryId))
      .returning({ placeId: placeCategory.placeId }),
    db
      .delete(category)
      .where(and(eq(category.id, categoryId), eq(category.mapId, mapId)))
      .returning(),
  ]);

  return c.json({
    category: deleted[0],
    unlinkedPlaceIds: unlinked.map((link) => link.placeId),
  });
});
