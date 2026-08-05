import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { map } from "./map";
import { placeCategory } from "./place-category";

export const category = sqliteTable(
  "category",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mapId: text("map_id")
      .notNull()
      .references(() => map.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("category_map_name_uidx").on(table.mapId, table.name),
  ],
);

export const categoryRelations = relations(category, ({ one, many }) => ({
  map: one(map, {
    fields: [category.mapId],
    references: [map.id],
  }),
  placeCategories: many(placeCategory),
}));
