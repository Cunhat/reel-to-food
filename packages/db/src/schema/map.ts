import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { category } from "./category";
import { job } from "./job";
import { mapMember } from "./map-member";
import { place } from "./place";

export const map = sqliteTable("map", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const mapRelations = relations(map, ({ one, many }) => ({
  owner: one(user, {
    fields: [map.ownerId],
    references: [user.id],
  }),
  members: many(mapMember),
  categories: many(category),
  places: many(place),
  jobs: many(job),
}));
