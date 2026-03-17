import React, { useEffect, useMemo, useState } from "react";
import { addLog } from "../services/api";
import { formatDate, toIsoDate } from "../utils/date";

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function getMonthName(year, month) {
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function buildMonth(year, month) {
  const days = [];
  const count = getDaysInMonth(year, month);
  const firstWeekday = new Date(year, month, 1).getDay();

  // Add blank slots for days before the 1st of the month
  for (let i = 0; i < firstWeekday; i++) {
    days.push(null);
  }

  for (let d = 1; d <= count; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function getPhaseForDate(date, cycles, phaseByDate, prediction, today, periodDays, currentPeriodStart) {
  if (!date) return { phase: null, predicted: false };

  const iso = toIsoDate(date);
  // If user logged this day as a period day, always show period.
  if (periodDays && periodDays.has(iso)) {
    return { phase: "period", predicted: false };
  }
  if (phaseByDate && phaseByDate.has(iso)) {
    return phaseByDate.get(iso);
  }

  if (!cycles || cycles.length === 0) return { phase: null, predicted: false };
  const dt = new Date(date);

  // Find the most recent real cycle (up to today)
  const pastCycle = cycles
    .filter((cycle) => new Date(cycle.cycle_start) <= dt)
    .sort((a, b) => new Date(b.cycle_start) - new Date(a.cycle_start))[0];

  const lastCycle = cycles
    .sort((a, b) => new Date(b.cycle_start) - new Date(a.cycle_start))[0];

  const makePhase = (start, periodLength, cycleLength, dayIndex) => {
    if (dayIndex < 0) return null;
    if (periodLength && dayIndex < periodLength) return "period";
    if (!cycleLength || cycleLength < 20) return null;

    const ovulationDayIndex = cycleLength - 14;
    const ovulationStartIndex = ovulationDayIndex - 2;
    const ovulationEndIndex = ovulationDayIndex + 2;

    if (dayIndex >= ovulationStartIndex && dayIndex <= ovulationEndIndex) {
      return "ovulation";
    }

    if (dayIndex > ovulationDayIndex) {
      return "luteal";
    }

    return "follicular";
  };

  // If this date is today or earlier and falls within a known cycle, use it.
  if (dt <= today && pastCycle) {
    const start = new Date(pastCycle.cycle_start);
    const periodLength = pastCycle.period_length ?? 0;
    const cycleLength = pastCycle.cycle_length ?? 0;
    const dayIndex = Math.floor((dt - start) / (1000 * 60 * 60 * 24));
    const phase = makePhase(start, periodLength, cycleLength, dayIndex);
    if (phase) {
      return { phase, predicted: false };
    }
  }

  // Future dates: prefer the most recent user-confirmed period start if available.
  if (dt > today) {
    const predictedLength = prediction?.predicted_cycle_length ? Math.round(prediction.predicted_cycle_length) : 0;
    const predictedNextPeriodIso = prediction?.next_period_estimate
      ? toIsoDate(new Date(prediction.next_period_estimate))
      : "";

    const anchor = currentPeriodStart
      ? new Date(currentPeriodStart)
      : predictedNextPeriodIso
        ? new Date(predictedNextPeriodIso)
        : null;

    // Use a reasonable period length hint from recent data; fall back to 5.
    const periodLengthHint = lastCycle?.period_length ?? 5;
    const periodLength = clamp(periodLengthHint, 1, 10);

    if (anchor && predictedLength >= 20) {
      anchor.setHours(0, 0, 0, 0);

      // If the user confirmed a period start, then "period → follicular → ovulation → luteal" begins from that date.
      if (currentPeriodStart) {
        const periodEnd = new Date(anchor);
        periodEnd.setDate(periodEnd.getDate() + periodLength);
        if (dt >= anchor && dt < periodEnd) {
          return { phase: "period", predicted: true };
        }

        const cycleEnd = new Date(anchor);
        cycleEnd.setDate(cycleEnd.getDate() + predictedLength);
        if (dt >= anchor && dt < cycleEnd) {
          const dayIndex = Math.floor((dt - anchor) / (1000 * 60 * 60 * 24));
          const phase = makePhase(anchor, periodLength, predictedLength, dayIndex);
          return { phase: phase || "follicular", predicted: true };
        }

        return { phase: null, predicted: false };
      }

      // Otherwise: before the next predicted period starts, we are in luteal (blue).
      if (dt < anchor) return { phase: "luteal", predicted: true };

      // Predicted period days (red).
      const periodEnd = new Date(anchor);
      periodEnd.setDate(periodEnd.getDate() + periodLength);
      if (dt >= anchor && dt < periodEnd) {
        return { phase: "period", predicted: true };
      }

      // After period starts, follow the next cycle phases using predicted cycle length.
      const cycleEnd = new Date(anchor);
      cycleEnd.setDate(cycleEnd.getDate() + predictedLength);
      if (dt >= anchor && dt < cycleEnd) {
        const dayIndex = Math.floor((dt - anchor) / (1000 * 60 * 60 * 24));
        const phase = makePhase(anchor, periodLength, predictedLength, dayIndex);
        return { phase: phase || "follicular", predicted: true };
      }
    }

    // Fallback: if we don't have prediction, do not attempt long-range phase coloring.
    return { phase: null, predicted: false };
  }

  return { phase: null, predicted: false };
}

function phaseTitle(phase) {
  switch (phase) {
    case "period":
      return "Period";
    case "follicular":
      return "Follicular";
    case "ovulation":
      return "Ovulation";
    case "luteal":
      return "Luteal";
    default:
      return "";
  }
}

function DayModal({ date, log, onClose, onSave }) {
  const [mood, setMood] = useState(log?.mood || "");
  const [symptoms, setSymptoms] = useState(log?.symptoms || "");
  const [isPeriodDay, setIsPeriodDay] = useState(Boolean(log?.flow_intensity));
  const [flowIntensity, setFlowIntensity] = useState(log?.flow_intensity || "");
  const [notes, setNotes] = useState(log?.notes || "");
  const [saving, setSaving] = useState(false);

  const moodOptions = [
    "",
    "Happy",
    "Neutral",
    "Irritated",
    "Stressed",
    "Tired",
    "Sad",
    "Cramping",
    "Other",
  ];

  const symptomOptions = [
    "",
    "Cramps",
    "Headache",
    "Bloating",
    "Fatigue",
    "Back pain",
    "Mood swings",
    "None",
    "Other",
  ];

  const flowOptions = [
    "",
    "Spotting",
    "Light",
    "Medium",
    "Heavy",
  ];

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        date: toIsoDate(date),
        mood,
        symptoms,
        flow_intensity: isPeriodDay ? flowIntensity : null,
        notes,
      };
      const res = await addLog(payload);
      onSave(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save log");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Daily log — {formatDate(date)}</h3>

        <form onSubmit={onSubmit}>
          <div className="section">
            <label className="label-row" htmlFor="periodDayToggle">
              <span>Period day?</span>
              <span className="toggle">
                <input
                  id="periodDayToggle"
                  type="checkbox"
                  checked={isPeriodDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsPeriodDay(checked);
                    if (!checked) setFlowIntensity("");
                  }}
                />
                <span className="toggle__track" aria-hidden="true" />
              </span>
            </label>
            <p className="small" style={{ margin: "8px 0 0" }}>
              Turn this on only if she’s actually bleeding today.
            </p>
          </div>

          <div className="section">
            <label>Mood</label>
            <select className="input" value={mood} onChange={(e) => setMood(e.target.value)}>
              {moodOptions.map((option) => (
                <option key={option} value={option}>
                  {option || "Select mood"}
                </option>
              ))}
            </select>
          </div>

          <div className="section">
            <label>Symptoms</label>
            <select
              className="input"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            >
              {symptomOptions.map((option) => (
                <option key={option} value={option}>
                  {option || "Select symptom"}
                </option>
              ))}
            </select>
          </div>

          {isPeriodDay ? (
            <div className="section">
              <label>Flow intensity</label>
              <select
                className="input"
                value={flowIntensity}
                onChange={(e) => setFlowIntensity(e.target.value)}
              >
                {flowOptions.map((option) => (
                  <option key={option} value={option}>
                    {option || "Select flow"}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="section">
            <label>Notes</label>
            <textarea
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildIsoRange(startIso, endIso) {
  if (!startIso || !endIso) return new Set();
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return new Set();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (start > end) return new Set();

  const set = new Set();
  const cur = new Date(start);
  while (cur <= end) {
    set.add(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return set;
}

export default function Calendar({ cycles = [], logs = [], phases = [], prediction = null }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [futurePhaseInfo, setFuturePhaseInfo] = useState(null);
  const [currentStart, setCurrentStart] = useState(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    return start;
  });
  const [monthsToShow, setMonthsToShow] = useState(3);

  const logByDate = useMemo(() => {
    const map = new Map();
    logs.forEach((l) => {
      map.set(l.date, l);
    });
    return map;
  }, [logs]);

  const periodDays = useMemo(() => {
    const set = new Set();
    logs.forEach((l) => {
      if (l?.flow_intensity) set.add(l.date);
    });
    return set;
  }, [logs]);

  const currentPeriodStart = useMemo(() => {
    // Find the most recent continuous run of period days (by flow_intensity).
    const isoDays = Array.from(periodDays)
      .map((d) => toIsoDate(d))
      .sort();
    if (!isoDays.length) return null;

    const todayIso = toIsoDate(new Date());
    // last period day not in the future
    const lastIdx = (() => {
      for (let i = isoDays.length - 1; i >= 0; i--) {
        if (isoDays[i] <= todayIso) return i;
      }
      return -1;
    })();
    if (lastIdx === -1) return null;

    let start = isoDays[lastIdx];
    for (let i = lastIdx; i > 0; i--) {
      const cur = new Date(isoDays[i]);
      const prev = new Date(isoDays[i - 1]);
      const diff = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) start = isoDays[i - 1];
      else break;
    }
    return start;
  }, [periodDays]);

  const phaseByDate = useMemo(() => {
    const map = new Map();
    phases.forEach((p) => {
      const iso = toIsoDate(new Date(p.date));
      let phase = (p.phase || "").toLowerCase();

      // Normalize to shape expected by CSS classes.
      if (p.period_flag === 1) {
        phase = "period";
      }
      if (phase === "menstrual") {
        phase = "period";
      }

      // Fallback to phase_code if present.
      if (!["period", "follicular", "ovulation", "luteal"].includes(phase)) {
        switch (p.phase_code) {
          case 0:
            phase = "period";
            break;
          case 1:
            phase = "follicular";
            break;
          case 2:
            phase = "ovulation";
            break;
          case 3:
            phase = "luteal";
            break;
          default:
            phase = null;
        }
      }

      if (phase) {
        map.set(iso, { phase, predicted: false });
      }
    });
    return map;
  }, [phases]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const predictedPeriodWindow = useMemo(() => {
    if (!prediction) return new Set();
    // If user confirmed a period start, compute next period window from that anchor.
    if (currentPeriodStart && prediction?.predicted_cycle_length) {
      const predictedLength = Math.round(prediction.predicted_cycle_length);
      const next = new Date(currentPeriodStart);
      next.setDate(next.getDate() + predictedLength);
      const start = new Date(next);
      start.setDate(start.getDate() - 2);
      const end = new Date(next);
      end.setDate(end.getDate() + 2);
      return buildIsoRange(toIsoDate(start), toIsoDate(end));
    }
    return buildIsoRange(prediction.prediction_window_start, prediction.prediction_window_end);
  }, [prediction, currentPeriodStart]);

  const predictedNextPeriodIso = useMemo(() => {
    if (currentPeriodStart && prediction?.predicted_cycle_length) {
      const predictedLength = Math.round(prediction.predicted_cycle_length);
      const next = new Date(currentPeriodStart);
      next.setDate(next.getDate() + predictedLength);
      return toIsoDate(next);
    }
    return prediction?.next_period_estimate ? toIsoDate(new Date(prediction.next_period_estimate)) : "";
  }, [prediction, currentPeriodStart]);

  const earliestAvailableStart = useMemo(() => {
    if (!phases || phases.length === 0) return new Date(1900, 0, 1);
    const minDate = new Date(Math.min(...phases.map((p) => new Date(p.date).getTime())));
    minDate.setDate(1);
    return minDate;
  }, [phases]);

  const latestAvailableStart = useMemo(() => {
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    return nextMonth;
  }, [today]);

  const clampStart = (date) => {
    const t = date.getTime();
    const minT = earliestAvailableStart.getTime();
    const maxT = latestAvailableStart.getTime();
    const clamped = Math.min(Math.max(t, minT), maxT);
    const out = new Date(clamped);
    out.setDate(1);
    return out;
  };

  // Ensure we never show a window outside of the available data range.
  useEffect(() => {
    setCurrentStart((prev) => clampStart(prev));
  }, [earliestAvailableStart, latestAvailableStart]);

  const months = useMemo(() => {
    const list = [];
    const base = new Date(currentStart);
    for (let i = 0; i < monthsToShow; i++) {
      const m = new Date(base);
      m.setMonth(base.getMonth() + i);
      list.push({ year: m.getFullYear(), month: m.getMonth() });
    }
    return list;
  }, [currentStart, monthsToShow]);

  const canGoEarlier = currentStart.getTime() > earliestAvailableStart.getTime();
  const canGoLater = currentStart.getTime() < latestAvailableStart.getTime();

  const shiftMonths = (offset) => {
    const next = new Date(currentStart);
    next.setMonth(next.getMonth() + offset);
    setCurrentStart(clampStart(next));
  };

  const handleSelectDay = (date) => {
    // Don't allow creating/editing logs in the future.
    if (date > today) {
      const { phase, predicted } = getPhaseForDate(
        date,
        cycles,
        phaseByDate,
        prediction,
        today,
        periodDays,
        currentPeriodStart
      );
      if (predicted && phase) {
        setFuturePhaseInfo({ date, phase });
      }
      return;
    }
    const iso = toIsoDate(date);
    setSelectedDate(date);
    setSelectedLog(logByDate.get(iso) || null);
  };

  const handleSaveLog = (log) => {
    setSelectedLog(log);
    setSelectedDate(null);
  };

  if ((!cycles || cycles.length === 0) && (!phases || phases.length === 0)) {
    return <p className="output">No cycle data available yet.</p>;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button className="button secondary" onClick={() => shiftMonths(-1)} disabled={!canGoEarlier}>
          Earlier
        </button>
        <button className="button secondary" onClick={() => shiftMonths(1)} disabled={!canGoLater}>
          Later
        </button>
      </div>

      <div className="calendar">
        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`} className="month">
            <header>
              <div className="month-title">{getMonthName(year, month)}</div>
            </header>
            <div className="days">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="day" style={{ fontWeight: 700, opacity: 0.8 }}>
                  {"SMTWTFS"[idx]}
                </div>
              ))}
              {buildMonth(year, month).map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="day day--empty" aria-hidden="true" />;
                }

                const iso = toIsoDate(day);
                const isToday = toIsoDate(today) === iso;
                const isPast = day < today;
                const { phase, predicted } = getPhaseForDate(
                  day,
                  cycles,
                  phaseByDate,
                  prediction,
                  today,
                  periodDays,
                  currentPeriodStart
                );
                const log = logByDate.get(iso);
                const isPredictedPeriodWindow = predictedPeriodWindow.has(iso);
                const isPredictedNextPeriod = predictedNextPeriodIso && iso === predictedNextPeriodIso;
                const tooltip =
                  !isPast && !isToday && predicted && phase
                    ? `Probable phase is ${phaseTitle(phase)}`
                    : "";

                return (
                  <div
                    key={iso}
                    className={`day ${phase ? `day--${phase}` : ""} ${
                      predicted ? "day--predicted" : ""
                    } ${isPredictedPeriodWindow ? "day--predicted-window" : ""} ${
                      isPredictedNextPeriod ? "day--predicted-day" : ""
                    } ${isPast ? "day--past" : ""} ${isToday ? "day--today" : ""}`}
                    onClick={() => handleSelectDay(day)}
                    title={tooltip}
                  >
                    <div>{day.getDate()}</div>
                    {log ? <div className="day-dot" /> : null}
                    {isPredictedPeriodWindow ? (
                      <div
                        className={`predict-dot ${isPredictedNextPeriod ? "predict-dot--strong" : ""}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedDate ? (
        <DayModal
          date={selectedDate}
          log={selectedLog}
          onClose={() => setSelectedDate(null)}
          onSave={handleSaveLog}
        />
      ) : null}

      {futurePhaseInfo ? (
        <div className="modal" onClick={() => setFuturePhaseInfo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Future day</h3>
            <p className="output" style={{ margin: 0 }}>
              Probable phase on <strong>{formatDate(futurePhaseInfo.date)}</strong> is{" "}
              <strong>{phaseTitle(futurePhaseInfo.phase)}</strong>.
            </p>
            <div className="modal-actions">
              <button className="button" type="button" onClick={() => setFuturePhaseInfo(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
