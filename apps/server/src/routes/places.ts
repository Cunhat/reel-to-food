import { zValidator } from "@hono/zod-validator";
import { createDb } from "@reel-to-food/db";
import { category } from "@reel-to-food/db/schema/category";
import { place } from "@reel-to-food/db/schema/place";
import { placeCategory } from "@reel-to-food/db/schema/place-category";
import { placeSource } from "@reel-to-food/db/schema/place-source";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { memberMiddleware } from "../../middlewares/member.middleware";
import {
  fetchPlaceDetails,
  isCoordsStale,
  isGooglePlacesConfigured,
  type PlaceDetailsResult,
} from "../lib/google-places";
import type { AppEnv } from "../types";

const db = createDb();

// Caps Google Place Details calls triggered by a single list request
const MAX_COORDS_REFRESH_PER_LIST = 20;

const updateCategoriesSchema = z.object({
  categoryIds: z.array(z.string().min(1)).max(50),
});

type PlaceRow = typeof place.$inferSelect;
type PlacePatch = Partial<
  Pick<PlaceRow, "latitude" | "longitude" | "coordsCachedAt" | "resolutionStatus">
>;

const placeWith = {
  categories: {
    columns: {},
    with: {
      category: { columns: { id: true, name: true } },
    },
  },
} as const;

function serializePlace(
  row: PlaceRow & { categories: { category: { id: string; name: string } }[] },
) {
  const { categories, ...rest } = row;
  return { ...rest, categories: categories.map((link) => link.category) };
}

function needsCoordsRefresh(row: PlaceRow, now: number) {
  return row.resolutionStatus === "resolved" && isCoordsStale(row.coordsCachedAt, now);
}

// Turns a Google lookup into the coords cache update for a place. Stale coords
// are cleared when they can't be refreshed, per the 30-day caching limit
function coordsPatch(row: PlaceRow, result: PlaceDetailsResult, now: number): PlacePatch | null {
  if (result.status === "ok" && result.place.latitude !== null) {
    return {
      latitude: result.place.latitude,
      longitude: result.place.longitude,
      coordsCachedAt: new Date(now),
    };
  }

  const clearCoords = { latitude: null, longitude: null, coordsCachedAt: null };

  if (result.status === "not_found") {
    return { ...clearCoords, resolutionStatus: "obsolete" };
  }

  if (row.coordsCachedAt && isCoordsStale(row.coordsCachedAt, now)) {
    return clearCoords;
  }

  return null;
}

async function findPlace(mapId: string, placeId: string) {
  return db.query.place.findFirst({
    where: (placesTable, { and, eq }) =>
      and(eq(placesTable.id, placeId), eq(placesTable.mapId, mapId)),
    with: placeWith,
  });
}

// Accepts ?categoryIds=a,b and/or repeated ?categoryIds=a&categoryIds=b
function parseCategoryIds(values: string[] | undefined) {
  const ids = (values ?? [])
    .flatMap((value) => value.split(","))
    .map((id) => id.trim())
    .filter(Boolean);

  return [...new Set(ids)];
}

// Mounted under /api/maps/:mapId/places; every map member has equal access
export const places = new Hono<AppEnv>();

places.use("*", memberMiddleware);

// List places of a map. With categoryIds, a place matches if it has any of them
places.get("/", async (c) => {
  const mapId = c.get("mapId");
  const categoryIds = parseCategoryIds(c.req.queries("categoryIds"));

  const rows = await db.query.place.findMany({
    where: (placesTable, { and, eq, inArray }) =>
      and(
        eq(placesTable.mapId, mapId),
        categoryIds.length > 0
          ? inArray(
              placesTable.id,
              db
                .select({ placeId: placeCategory.placeId })
                .from(placeCategory)
                .where(inArray(placeCategory.categoryId, categoryIds)),
            )
          : undefined,
      ),
    with: placeWith,
    orderBy: (placesTable, { desc }) => desc(placesTable.createdAt),
  });

  const now = Date.now();
  const toRefresh = isGooglePlacesConfigured()
    ? rows.filter((row) => needsCoordsRefresh(row, now)).slice(0, MAX_COORDS_REFRESH_PER_LIST)
    : [];
  const refreshed = new Map(
    await Promise.all(
      toRefresh.map(async (row) => [row.id, await fetchPlaceDetails(row.googlePlaceId)] as const),
    ),
  );

  const patches = new Map<string, PlacePatch>();
  for (const row of rows) {
    const result = refreshed.get(row.id) ?? { status: "unavailable" as const };
    const patch = coordsPatch(row, result, now);
    if (patch) {
      patches.set(row.id, patch);
    }
  }

  const updates = [...patches].map(([placeId, patch]) =>
    db.update(place).set(patch).where(eq(place.id, placeId)),
  );
  if (updates.length > 0) {
    await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
  }

  return c.json({
    places: rows.map((row) => serializePlace({ ...row, ...patches.get(row.id) })),
  });
});

// Get a place with its sources. Google name/address are refetched on every
// request and returned alongside the row, never stored
places.get("/:placeId", async (c) => {
  const mapId = c.get("mapId");
  const placeId = c.req.param("placeId");

  const found = await findPlace(mapId, placeId);

  if (!found) {
    return c.json({ error: "Place not found" }, 404);
  }

  const now = Date.now();
  const result = await fetchPlaceDetails(found.googlePlaceId);
  const patch = coordsPatch(found, result, now);

  if (patch) {
    await db.update(place).set(patch).where(eq(place.id, found.id));
  }

  const sources = await db.query.placeSource.findMany({
    where: (sourcesTable, { eq }) => eq(sourcesTable.placeId, found.id),
    orderBy: (sourcesTable, { desc }) => desc(sourcesTable.createdAt),
  });

  const google =
    result.status === "ok"
      ? {
          displayName: result.place.displayName,
          formattedAddress: result.place.formattedAddress,
          googleMapsUri: result.place.googleMapsUri,
        }
      : null;

  return c.json({
    place: {
      ...serializePlace({ ...found, ...patch }),
      displayName: found.userDisplayName ?? google?.displayName ?? null,
      formattedAddress: found.userFormattedAddress ?? google?.formattedAddress ?? null,
      google,
      sources,
    },
  });
});

// List the reels a place was imported from
places.get("/:placeId/sources", async (c) => {
  const mapId = c.get("mapId");
  const placeId = c.req.param("placeId");

  const found = await db.query.place.findFirst({
    where: (placesTable, { and, eq }) =>
      and(eq(placesTable.id, placeId), eq(placesTable.mapId, mapId)),
    columns: { id: true },
  });

  if (!found) {
    return c.json({ error: "Place not found" }, 404);
  }

  const sources = await db.query.placeSource.findMany({
    where: (sourcesTable, { eq }) => eq(sourcesTable.placeId, placeId),
    with: {
      createdBy: { columns: { id: true, name: true, image: true } },
    },
    orderBy: (sourcesTable, { desc }) => desc(sourcesTable.createdAt),
  });

  return c.json({ sources });
});

// Replace the categories of a place with the given set
places.put("/:placeId/categories", zValidator("json", updateCategoriesSchema), async (c) => {
  const mapId = c.get("mapId");
  const placeId = c.req.param("placeId");
  const categoryIds = [...new Set(c.req.valid("json").categoryIds)];

  const found = await db.query.place.findFirst({
    where: (placesTable, { and, eq }) =>
      and(eq(placesTable.id, placeId), eq(placesTable.mapId, mapId)),
    columns: { id: true },
  });

  if (!found) {
    return c.json({ error: "Place not found" }, 404);
  }

  if (categoryIds.length > 0) {
    const mapCategories = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.mapId, mapId), inArray(category.id, categoryIds)));

    if (mapCategories.length !== categoryIds.length) {
      const known = new Set(mapCategories.map((row) => row.id));
      return c.json(
        {
          error: "Some categories do not exist on this map",
          categoryIds: categoryIds.filter((id) => !known.has(id)),
        },
        400,
      );
    }
  }

  const unlink = db.delete(placeCategory).where(eq(placeCategory.placeId, placeId));

  if (categoryIds.length > 0) {
    await db.batch([
      unlink,
      db
        .insert(placeCategory)
        .values(categoryIds.map((categoryId) => ({ placeId, categoryId }))),
      db.update(place).set({ updatedAt: new Date() }).where(eq(place.id, placeId)),
    ]);
  } else {
    await db.batch([
      unlink,
      db.update(place).set({ updatedAt: new Date() }).where(eq(place.id, placeId)),
    ]);
  }

  const updated = await findPlace(mapId, placeId);

  return c.json({ place: updated ? serializePlace(updated) : null });
});

// Delete a place along with its category links and sources
places.delete("/:placeId", async (c) => {
  const mapId = c.get("mapId");
  const placeId = c.req.param("placeId");

  const found = await db.query.place.findFirst({
    where: (placesTable, { and, eq }) =>
      and(eq(placesTable.id, placeId), eq(placesTable.mapId, mapId)),
    columns: { id: true },
  });

  if (!found) {
    return c.json({ error: "Place not found" }, 404);
  }

  // Remove children explicitly rather than relying on the FK cascade being enforced
  const [, , deleted] = await db.batch([
    db.delete(placeCategory).where(eq(placeCategory.placeId, placeId)),
    db.delete(placeSource).where(eq(placeSource.placeId, placeId)),
    db
      .delete(place)
      .where(and(eq(place.id, placeId), eq(place.mapId, mapId)))
      .returning(),
  ]);

  return c.json({ place: deleted[0] });
});
