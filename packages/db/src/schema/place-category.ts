import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { category } from "./category";
import { place } from "./place";

export const placeCategory = sqliteTable(
  "place_category",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    placeId: text("place_id")
      .notNull()
      .references(() => place.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("place_category_place_category_uidx").on(
      table.placeId,
      table.categoryId,
    ),
  ],
);

export const placeCategoryRelations = relations(placeCategory, ({ one }) => ({
  place: one(place, {
    fields: [placeCategory.placeId],
    references: [place.id],
  }),
  category: one(category, {
    fields: [placeCategory.categoryId],
    references: [category.id],
  }),
}));
