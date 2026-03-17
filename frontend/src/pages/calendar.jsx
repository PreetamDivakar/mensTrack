import React, { useEffect, useState } from "react";
import { getCycles, getLogs, getPrediction, getPatterns, getPhases } from "../services/api";
import { toIsoDate } from "../utils/date";
import Calendar from "../components/Calendar";
import PrettyDate from "../components/PrettyDate";

const PROFILE_ID = null;

export default function CalendarPage() {
  const [cycles, setCycles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [phases, setPhases] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - 3);
    const end = new Date(today);
    end.setMonth(end.getMonth() + 3);

    const params = {
      start_date: toIsoDate(start),
      end_date: toIsoDate(end),
      profile_id: PROFILE_ID,
    };

    const cyclePromise = getCycles();
    const logPromise = getLogs(params);
    const phasePromise = getPhases();
    const predictionPromise = getPrediction();
    const patternsPromise = getPatterns();

    Promise.all([cyclePromise, logPromise, phasePromise, predictionPromise, patternsPromise])
      .then(([cycleRes, logRes, phaseRes, predictionRes, patternsRes]) => {
        setCycles(cycleRes.data);
        setLogs(logRes.data);
        setPhases(phaseRes.data);
        setPrediction(predictionRes.data);
        setPatterns(patternsRes.data);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, []);

  const renderReminder = () => {
    if (!patterns) return null;

    const items = [];
    if (patterns.upcoming_period_days != null) {
      const days = patterns.upcoming_period_days;
      if (days < 0) {
        items.push({ kind: "period", text: "Period may have started already — check in." });
      } else if (days === 0) {
        items.push({ kind: "period", text: "Period is expected today." });
      } else if (days <= 3) {
        items.push({ kind: "period", text: `Period is expected in ${days} day${days === 1 ? "" : "s"}.` });
      }
    }
    if (patterns.upcoming_ovulation_days != null) {
      const days = patterns.upcoming_ovulation_days;
      if (days >= 0 && days <= 3) {
        items.push({
          kind: "ovulation",
          text: `Ovulation window is coming in ${days} day${days === 1 ? "" : "s"}.`,
        });
      }
    }

    if (items.length === 0) return null;

    return (
      <div className="card card--lift" style={{ marginBottom: 18 }}>
        <strong>Upcoming</strong>
        <div className="section" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {items.map((it) => (
            <div key={`${it.kind}-${it.text}`} className={`pill pill--${it.kind}`} style={{ fontWeight: 800 }}>
              {it.text}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStats = () => {
    if (!prediction || !patterns) return null;

    return (
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>Prediction</p>
            <p className="small" style={{ margin: "6px 0 0" }}>
              Next period: {prediction.next_period_estimate ? <PrettyDate value={prediction.next_period_estimate} /> : "—"}
              <br />
              Window:{" "}
              {prediction.prediction_window_start ? <PrettyDate value={prediction.prediction_window_start} /> : "—"} →{" "}
              {prediction.prediction_window_end ? <PrettyDate value={prediction.prediction_window_end} /> : "—"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="small" style={{ margin: 0 }}>
              Confidence: <strong>{Math.round(prediction.confidence * 100)}%</strong>
            </p>
            <p className="small" style={{ margin: "6px 0 0" }}>
              Trend: <strong>{patterns.cycle_trend}</strong>
            </p>
          </div>
        </div>

        <div className="section" style={{ marginTop: 16 }}>
          <strong>Phase legend</strong>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="legend-swatch legend-period" />
              <span className="small">Menstruation (period)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="legend-swatch legend-follicular" />
              <span className="small">Follicular</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="legend-swatch legend-ovulation" />
              <span className="small">Ovulation</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="legend-swatch legend-luteal" />
              <span className="small">Luteal</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="legend-swatch" style={{ background: "rgba(255, 75, 90, 0.18)", border: "1px solid rgba(255, 75, 90, 0.28)" }} />
              <span className="small">Predicted period window</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="stack">
      <h2>Cycle Calendar</h2>

      {renderReminder()}
      {renderStats()}

      <div className="card card--lift">
        {loading ? (
          <p className="output">Loading your cycle history…</p>
        ) : (
          <Calendar
            cycles={cycles}
            logs={logs}
            phases={phases}
            prediction={prediction}
            profileId={PROFILE_ID}
          />
        )}
      </div>

    </div>
  );
}