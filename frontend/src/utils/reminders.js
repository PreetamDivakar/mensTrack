import { getPatterns } from "../services/api";

const STORAGE_KEY = "periodTrackerReminders";

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getReminderSettings() {
  const s = loadSettings();
  return {
    enabled: Boolean(s.enabled),
    hour: typeof s.hour === "number" ? s.hour : 9,
    minute: typeof s.minute === "number" ? s.minute : 0,
    lastFiredKey: typeof s.lastFiredKey === "string" ? s.lastFiredKey : "",
  };
}

export function setReminderSettings(next) {
  const prev = getReminderSettings();
  saveSettings({ ...prev, ...next });
}

function todayKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function msUntil(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

async function maybeNotify() {
  const settings = getReminderSettings();
  if (!settings.enabled) return;
  if (!("Notification" in window)) return;

  const permission = Notification.permission;
  if (permission !== "granted") return;

  const key = todayKey();
  if (settings.lastFiredKey === key) return;

  let patterns = null;
  try {
    const res = await getPatterns();
    patterns = res.data;
  } catch {
    // ignore - no notification if API fails
    return;
  }

  const d = patterns?.upcoming_period_days;
  if (typeof d !== "number") return;

  // Gentle, low-noise notifications.
  let body = null;
  if (d === 0) body = "Possible period start today. Be gentle and supportive.";
  else if (d === 1) body = "Possible period tomorrow. Plan comfort + keep things easy.";
  else if (d === 2) body = "Possible period in 2 days. Keep plans light and check in.";
  else if (d === 3) body = "Possible period in 3 days. Small kindness goes a long way.";

  if (!body) return;

  new Notification("Cycle Tracker", { body });
  setReminderSettings({ lastFiredKey: key });
}

export function startReminderScheduler() {
  // Runs while the app is open/installed. (True background delivery requires push, which we’re not using here.)
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    await maybeNotify();
    const { hour, minute } = getReminderSettings();
    const delay = msUntil(hour, minute);
    setTimeout(tick, delay);
  };

  const initial = getReminderSettings();
  const delay = msUntil(initial.hour, initial.minute);
  setTimeout(tick, delay);

  return () => {
    stopped = true;
  };
}

