import { relations } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { confidenceLevels, placeResolutionStatuses } from "./enums";
import { map } from "./map";
import { placeCategory } from "./place-category";
import { placeSource } from "./place-source";

export {
  confidenceLevels,
  placeResolutionStatuses,
  type ConfidenceLevel,
  type PlaceResolutionStatus,
} from "./enums";

export const place = sqliteTable(
  "place",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mapId: text("map_id")
      .notNull()
      .references(() => map.id, { onDelete: "cascade" }),
    googlePlaceId: text("google_place_id").notNull(),
    resolutionStatus: text("resolution_status", {
      enum: placeResolutionStatuses,
    })
      .notNull()
      .default("resolved"),
    confidence: text("confidence", { enum: confidenceLevels }),
    // Optional ≤30-day Google coords cache (refresh or clear after TTL)
    latitude: real("latitude"),
    longitude: real("longitude"),
    coordsCachedAt: integer("coords_cached_at", { mode: "timestamp_ms" }),
    // User-authored overrides only (not durable Google content warehouse)
    userDisplayName: text("user_display_name"),
    userFormattedAddress: text("user_formatted_address"),
    notes: text("notes"),
    image: text("image"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("place_map_google_place_uidx").on(
      table.mapId,
      table.googlePlaceId,
    ),
  ],
);

export const placeRelations = relations(place, ({ one, many }) => ({
  map: one(map, {
    fields: [place.mapId],
    references: [map.id],
  }),
  createdBy: one(user, {
    fields: [place.createdByUserId],
    references: [user.id],
  }),
  categories: many(placeCategory),
  sources: many(placeSource),
}));
