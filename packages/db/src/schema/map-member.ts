import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { mapMemberRoles } from "./enums";
import { map } from "./map";

export { mapMemberRoles, type MapMemberRole } from "./enums";

export const mapMember = sqliteTable(
  "map_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mapId: text("map_id")
      .notNull()
      .references(() => map.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: mapMemberRoles }).notNull().default("member"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("map_member_map_user_uidx").on(table.mapId, table.userId),
  ],
);

export const mapMemberRelations = relations(mapMember, ({ one }) => ({
  map: one(map, {
    fields: [mapMember.mapId],
    references: [map.id],
  }),
  user: one(user, {
    fields: [mapMember.userId],
    references: [user.id],
  }),
}));
