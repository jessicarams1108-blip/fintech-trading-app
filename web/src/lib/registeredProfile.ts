/** Signup details kept until saved to the account profile on the server. */
export const REGISTERED_PROFILE_KEY = "oove_registered_profile";

export type RegisteredProfile = {
  firstName: string;
  lastName: string;
  username: string;
  fullName: string;
};

export function saveRegisteredProfile(profile: RegisteredProfile): void {
  try {
    localStorage.setItem(REGISTERED_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readRegisteredProfile(): RegisteredProfile | null {
  try {
    const raw = localStorage.getItem(REGISTERED_PROFILE_KEY);
    if (!raw) return null;
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
  } catch {
    /* ignore */
  }
  return null;
}

export function clearRegisteredProfile(): void {
  try {
    localStorage.removeItem(REGISTERED_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
