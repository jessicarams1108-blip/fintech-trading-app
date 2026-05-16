import type { ProfileDto } from "@/lib/settingsApi";
import type { AuthUser } from "@/state/AuthContext";
import type { RegisteredProfile } from "@/lib/registeredProfile";

function joinFirstLast(first?: string | null, last?: string | null): string {
  return [first, last]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .join(" ")
    .trim();
}

export function resolveProfileFields(
  profile: ProfileDto | undefined,
  authUser: AuthUser | null,
  registered: RegisteredProfile | null,
): { fullName: string; username: string } {
  const fullName =
    profile?.fullName?.trim() ||
    authUser?.fullName?.trim() ||
    registered?.fullName?.trim() ||
    joinFirstLast(profile?.firstName, profile?.lastName) ||
    joinFirstLast(authUser?.firstName, authUser?.lastName) ||
    joinFirstLast(registered?.firstName, registered?.lastName) ||
    "";

  const username = (profile?.username ?? authUser?.username ?? registered?.username ?? "").trim();

  return { fullName, username };
}
