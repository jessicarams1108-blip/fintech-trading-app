/** Signup details kept until saved to the account profile on the server. */
export const REGISTERED_PROFILE_KEY_PREFIX = "oove_registered_profile:";

export type RegisteredProfile = {
  firstName: string;
  lastName: string;
  username: string;
  fullName: string;
};

function storageKey(userId: string): string {
  return `${REGISTERED_PROFILE_KEY_PREFIX}${userId}`;
}

export function saveRegisteredProfile(userId: string, profile: RegisteredProfile): void {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(profile));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readRegisteredProfile(userId?: string | null): RegisteredProfile | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return readLegacyRegisteredProfile();
    return parseRegisteredProfile(raw);
  } catch {
    return null;
  }
}

/** @deprecated global key from earlier builds */
function readLegacyRegisteredProfile(): RegisteredProfile | null {
  try {
    const raw = localStorage.getItem("oove_registered_profile");
    if (!raw) return null;
    return parseRegisteredProfile(raw);
  } catch {
    return null;
  }
}

function parseRegisteredProfile(raw: string): RegisteredProfile | null {
  const parsed = JSON.parse(raw) as RegisteredProfile;
  if (
    typeof parsed.firstName === "string" &&
    typeof parsed.lastName === "string" &&
    typeof parsed.username === "string"
  ) {
    const fullName =
      typeof parsed.fullName === "string" && parsed.fullName.trim().length > 0
        ? parsed.fullName.trim()
        : [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim();
    return { ...parsed, fullName };
  }
  return null;
}

export function profileFromAuthUser(user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  fullName?: string;
}): RegisteredProfile | null {
  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  const username = user.username?.trim() ?? "";
  const fullName = user.fullName?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!fullName && !username) return null;
  return { firstName, lastName, username, fullName };
}

export function clearRegisteredProfile(userId?: string | null): void {
  try {
    if (userId) localStorage.removeItem(storageKey(userId));
    localStorage.removeItem("oove_registered_profile");
  } catch {
    /* ignore */
  }
}
