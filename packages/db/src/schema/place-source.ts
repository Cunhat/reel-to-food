import { relations } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { job } from "./job";
import { place } from "./place";

export const placeSource = sqliteTable(
  "place_source",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    placeId: text("place_id")
      .notNull()
      .references(() => place.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    jobId: text("job_id").references(() => job.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("place_source_place_url_uidx").on(
      table.placeId,
      table.sourceUrl,
    ),
  ],
);

export const placeSourceRelations = relations(placeSource, ({ one }) => ({
  place: one(place, {
    fields: [placeSource.placeId],
    references: [place.id],
  }),
  job: one(job, {
    fields: [placeSource.jobId],
    references: [job.id],
  }),
  createdBy: one(user, {
    fields: [placeSource.createdByUserId],
    references: [user.id],
  }),
}));
