import React, { useEffect, useMemo, useState } from "react";
import { getLogs, getPatterns, getPhases, getPrediction } from "../services/api";
import { toIsoDate } from "../utils/date";
import { getReminderSettings, setReminderSettings } from "../utils/reminders";
import PrettyDate from "../components/PrettyDate";

function normalizePhase(p) {
  if (!p) return null;
  const phase = (p.phase || "").toLowerCase();
  if (p.period_flag === 1) return "period";
  if (phase === "menstrual") return "period";
  if (["period", "follicular", "ovulation", "luteal"].includes(phase)) return phase;
  switch (p.phase_code) {
    case 0:
      return "period";
    case 1:
      return "follicular";
    case 2:
      return "ovulation";
    case 3:
      return "luteal";
    default:
      return null;
  }
}

function phaseLabel(phase) {
  switch (phase) {
    case "period":
      return "Menstruation (Period)";
    case "follicular":
      return "Follicular Phase";
    case "ovulation":
      return "Ovulation Window";
    case "luteal":
      return "Luteal Phase";
    default:
      return "Unknown / not enough data";
  }
}

function guidanceForPhase(phase) {
  const common = {
    do: [
      "Ask one simple check-in: “How are you feeling today?”",
      "Offer help with one concrete thing (food, errands, water, rest).",
      "Be consistent and calm—small kindness beats big speeches.",
    ],
    dont: ["Don’t argue to “win.”", "Don’t dismiss symptoms as “overreacting.”", "Don’t force plans if energy is low."],
    vibe: "Supportive, steady, low-pressure.",
    likelyMood: "Varies—use today’s log if you have one.",
    gift: "A warm message + a small comfort action.",
  };

  if (phase === "period") {
    return {
      ...common,
      likelyMood: "Lower energy, more sensitive, needs comfort.",
      vibe: "Gentle care, comfort-first.",
      do: [
        "Offer a heating pad/tea/warm food.",
        "Be extra patient with tone & timing.",
        "Ask if she wants company or quiet—both are valid.",
        ...common.do,
      ],
      dont: ["Don’t tease about mood swings.", "Don’t push hard conversations today.", ...common.dont],
      gift: "Comfort food, warm drink, or a short “I’m here” text.",
    };
  }

  if (phase === "follicular") {
    return {
      ...common,
      likelyMood: "More energetic, optimistic, social.",
      vibe: "Playful and motivating.",
      do: [
        "Plan a light date / walk / fun activity.",
        "Compliment genuinely (effort, style, vibe).",
        "Encourage goals—this is often a high-energy phase.",
        ...common.do,
      ],
      dont: [...common.dont],
      gift: "A cute plan + a thoughtful compliment.",
    };
  }

  if (phase === "ovulation") {
    return {
      ...common,
      likelyMood: "Confident, affectionate, high energy.",
      vibe: "Flirty, attentive, romantic.",
      do: [
        "Be present—quality time hits hard here.",
        "Plan something special (date night, photos, small surprise).",
        "Communicate appreciation and attraction respectfully.",
        ...common.do,
      ],
      dont: ["Don’t be careless with boundaries.", ...common.dont],
      gift: "Romantic energy: flowers, dessert, or a planned date.",
    };
  }

  if (phase === "luteal") {
    return {
      ...common,
      likelyMood: "More easily irritated, tired, craving comfort—PMS can show up.",
      vibe: "Calm, reassuring, minimal drama.",
      do: [
        "Reduce friction: be clear, kind, and predictable.",
        "Offer comfort snacks + rest time.",
        "Avoid last-minute changes; keep things simple.",
        ...common.do,
      ],
      dont: ["Don’t escalate small issues.", "Don’t make jokes about hormones.", ...common.dont],
      gift: "Comfort snacks + “I’ve got you” energy.",
    };
  }

  return common;
}

export default function TodayPage() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [reminders, setReminders] = useState(() => getReminderSettings());

  useEffect(() => {
    const iso = toIsoDate(today);
    setLoading(true);

    Promise.all([
      getPhases(),
      getLogs({ date: iso }),
      getPrediction(),
      getPatterns(),
    ])
      .then(([phasesRes, logsRes, predRes, patternsRes]) => {
        const phases = phasesRes.data || [];
        const match = phases.find((p) => toIsoDate(new Date(p.date)) === iso);
        setPhase(match ? normalizePhase(match) : null);

        const logs = logsRes.data || [];
        setTodayLog(logs.length ? logs[logs.length - 1] : null);

        setPrediction(predRes.data);
        setPatterns(patternsRes.data);
      })
      .catch((e) => {
        console.error(e);
        setPhase(null);
        setTodayLog(null);
      })
      .finally(() => setLoading(false));
  }, [today]);

  const guidance = useMemo(() => guidanceForPhase(phase), [phase]);

  const toggleReminders = async () => {
    if (!("Notification" in window)) return;
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      setReminderSettings({ enabled: false });
      setReminders(getReminderSettings());
      return;
    }
    setReminderSettings({ enabled: !reminders.enabled });
    setReminders(getReminderSettings());
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2 style={{ margin: 0 }}>Today</h2>
          <p className="small" style={{ margin: "6px 0 0" }}>
            <PrettyDate value={today} /> · Your daily boyfriend guide
          </p>
        </div>
        <button className={`button ${reminders.enabled ? "secondary" : ""}`} type="button" onClick={toggleReminders}>
          {reminders.enabled ? "Reminders on" : "Enable reminders"}
        </button>
      </div>

      <div className="grid grid-2">
        <div className="card card--lift">
          <h3 style={{ marginTop: 0 }}>Today’s phase</h3>
          {loading ? (
            <p className="output">Loading…</p>
          ) : (
            <>
              <p className="output" style={{ margin: 0 }}>
                <span className={`pill ${phase ? `pill--${phase}` : ""}`}>{phaseLabel(phase)}</span>
              </p>
              <div className="section">
                <p className="small" style={{ margin: 0 }}>
                  Likely mood: <strong style={{ color: "var(--text)" }}>{guidance.likelyMood}</strong>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="card card--lift">
          <h3 style={{ marginTop: 0 }}>Today’s check-in</h3>
          {loading ? (
            <p className="output">Loading…</p>
          ) : !todayLog ? (
            <p className="output">
              No log saved for today yet. Open the Calendar and click today to add mood/symptoms/notes.
            </p>
          ) : (
            <div className="output" style={{ margin: 0 }}>
              <p style={{ margin: 0 }}>
                <strong>Mood:</strong> {todayLog.mood || "—"}
                <br />
                <strong>Symptoms:</strong> {todayLog.symptoms || "—"}
                <br />
                <strong>Notes:</strong> {todayLog.notes || "—"}
                <br />
                <strong>Flow:</strong> {todayLog.flow_intensity || "—"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card--lift">
          <h3 style={{ marginTop: 0 }}>Do</h3>
          <ul className="list">
            {guidance.do.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="card card--lift">
          <h3 style={{ marginTop: 0 }}>Don’t</h3>
          <ul className="list">
            {guidance.dont.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card card--lift">
        <h3 style={{ marginTop: 0 }}>What’s coming</h3>
        {!prediction || !patterns ? (
          <p className="output">Loading…</p>
        ) : (
          <div className="grid grid-3">
            <div className="stat">
              <div className="stat__label">Next period</div>
              <div className="stat__value">
                {prediction.next_period_estimate ? <PrettyDate value={prediction.next_period_estimate} /> : "—"}
              </div>
            </div>
            <div className="stat">
              <div className="stat__label">Period in</div>
              <div className="stat__value">{patterns.upcoming_period_days ?? "—"} days</div>
            </div>
            <div className="stat">
              <div className="stat__label">Ovulation in</div>
              <div className="stat__value">{patterns.upcoming_ovulation_days ?? "—"} days</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

