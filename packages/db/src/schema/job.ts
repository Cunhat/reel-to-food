import { relations } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import {
  confidenceLevels,
  jobCandidateStatuses,
  jobStages,
  jobStatuses,
} from "./enums";
import { map } from "./map";
import { placeSource } from "./place-source";

export {
  jobCandidateStatuses,
  jobStages,
  jobStatuses,
  type JobCandidateStatus,
  type JobStage,
  type JobStatus,
} from "./enums";

export const job = sqliteTable(
  "job",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mapId: text("map_id")
      .notNull()
      .references(() => map.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    canonicalSourceUrl: text("canonical_source_url").notNull(),
    shareId: text("share_id"),
    status: text("status", { enum: jobStatuses }).notNull().default("processing"),
    stage: text("stage", { enum: jobStages }).notNull().default("queued"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("job_share_id_uidx").on(table.shareId),
    index("job_map_id_idx").on(table.mapId),
    index("job_map_canonical_creator_idx").on(
      table.mapId,
      table.canonicalSourceUrl,
      table.createdByUserId,
    ),
  ],
);

export const jobCandidate = sqliteTable(
  "job_candidate",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    googlePlaceId: text("google_place_id"),
    displayName: text("display_name"),
    formattedAddress: text("formatted_address"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    confidence: text("confidence", { enum: confidenceLevels }),
    status: text("status", { enum: jobCandidateStatuses })
      .notNull()
      .default("pending"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("job_candidate_job_id_idx").on(table.jobId)],
);

export const jobRelations = relations(job, ({ one, many }) => ({
  map: one(map, {
    fields: [job.mapId],
    references: [map.id],
  }),
  createdBy: one(user, {
    fields: [job.createdByUserId],
    references: [user.id],
  }),
  candidates: many(jobCandidate),
  placeSources: many(placeSource),
}));

export const jobCandidateRelations = relations(jobCandidate, ({ one }) => ({
  job: one(job, {
    fields: [jobCandidate.jobId],
    references: [job.id],
  }),
}));
