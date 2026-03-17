const PROFILE_ID_STORAGE_KEY = "periodTrackerProfileId";

export function getProfileId() {
  return localStorage.getItem(PROFILE_ID_STORAGE_KEY);
}

export function setProfileId(id) {
  localStorage.setItem(PROFILE_ID_STORAGE_KEY, id);
}

export function clearProfileId() {
  localStorage.removeItem(PROFILE_ID_STORAGE_KEY);
}

export function ensureProfileId() {
  let id = getProfileId();
  if (!id) {
    // crypto.randomUUID is supported in modern browsers.
    id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setProfileId(id);
  }
  return id;
}
