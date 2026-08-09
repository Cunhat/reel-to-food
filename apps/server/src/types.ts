import type { createAuth } from "@reel-to-food/auth";
import type { mapMember } from "@reel-to-food/db/schema/map-member";

type Auth = ReturnType<typeof createAuth>;
type Session = Auth["$Infer"]["Session"];

export type AppEnv = {
  Variables: {
    user: Session["user"];
    session: Session["session"];
    mapId: string;
    member: typeof mapMember.$inferSelect;
  };
};
