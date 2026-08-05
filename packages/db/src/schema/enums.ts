export const mapMemberRoles = ["member", "owner"] as const;
export type MapMemberRole = (typeof mapMemberRoles)[number];

export const confidenceLevels = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const placeResolutionStatuses = [
  "resolved",
  "unresolved",
  "obsolete",
] as const;
export type PlaceResolutionStatus = (typeof placeResolutionStatuses)[number];

export const jobStatuses = [
  "processing",
  "ready_for_review",
  "completed",
  "completed_empty",
  "failed",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const jobStages = ["queued", "running"] as const;
export type JobStage = (typeof jobStages)[number];

export const jobCandidateStatuses = [
  "pending",
  "confirmed",
  "discarded",
] as const;
export type JobCandidateStatus = (typeof jobCandidateStatuses)[number];
