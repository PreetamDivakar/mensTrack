import React, { useEffect, useState } from "react";
import { getCycles, getPatterns, getPrediction } from "../services/api";
import { formatRelativeDays } from "../utils/date";
import PrettyDate from "../components/PrettyDate";

export default function Home() {
  const [prediction, setPrediction] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [cycles, setCycles] = useState([]);
  const [showConfidenceInfo, setShowConfidenceInfo] = useState(false);

  const loadPrediction = async () => {
    setLoading(true);
    try {
      const res = await getPrediction();
      setPrediction(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPatterns = async () => {
    try {
      const res = await getPatterns();
      setPatterns(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCycles = async () => {
    try {
      const res = await getCycles();
      setCycles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifEnabled(permission === "granted");

    if (permission === "granted" && patterns?.upcoming_period_days != null) {
      const when = patterns.upcoming_period_days;
      const body = when === 0 ? "Your period may start today." : `Next period in ${when} days.`;
      new Notification("Period Tracker", { body });
    }
  };

  useEffect(() => {
    loadPrediction();
    loadPatterns();
    loadCycles();
  }, []);

  useEffect(() => {
    if (!notifEnabled || !patterns) return;

    const days = patterns.upcoming_period_days;
    if (typeof days !== "number") return;

    const delay = Math.max(0, days) * 24 * 60 * 60 * 1000;
    const timer = setTimeout(() => {
      new Notification("Period Tracker Reminder", {
        body: days === 0 ? "Your period may start today." : `Period expected in ${days} days.`,
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [notifEnabled, patterns]);

  const confidence = prediction ? Math.round(prediction.confidence * 100) : 0;

  const hasPrediction = Boolean(prediction && !prediction.message);
  const lastCycleLength = cycles?.length ? cycles[cycles.length - 1]?.cycle_length : null;

  return (
    <div className="stack">
      <h2>Prediction & Insights</h2>

      <div className="card card--lift">
        {loading ? (
          <p className="output">Loading your prediction…</p>
        ) : !prediction ? (
          <p className="output">Unable to load prediction at this time.</p>
        ) : prediction.message ? (
          <p className="output">{prediction.message}</p>
        ) : (
          <div className="output">
            <p>
              <strong>Next Period</strong>
              <br />
              {prediction.next_period_estimate ? <PrettyDate value={prediction.next_period_estimate} /> : "—"}
            </p>

            <p>
              <strong>Window</strong>
              <br />
              {prediction.prediction_window_start ? <PrettyDate value={prediction.prediction_window_start} /> : "—"} —{" "}
              {prediction.prediction_window_end ? <PrettyDate value={prediction.prediction_window_end} /> : "—"}
            </p>

            <p>
              <strong>Expected Cycle Length</strong>
              <br />
              {prediction.predicted_cycle_length} days
            </p>

            <div className="section">
              <div className="progress" aria-label="Prediction confidence">
                <div
                  className="progress__fill"
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <p className="small">Confidence: {confidence}%</p>
            </div>

            {prediction.irregular ? (
              <button
                type="button"
                className="badge warning"
                style={{ cursor: "pointer", border: "none" }}
                onClick={() => setShowConfidenceInfo(true)}
                aria-label="Why irregular and confidence?"
                title="Click to learn why"
              >
                Irregular cycle detected
              </button>
            ) : (
              <p className="badge success">Regular pattern detected</p>
            )}
          </div>
        )}

        <button className="button" onClick={loadPrediction} style={{ marginTop: 16 }}>
          Refresh Prediction
        </button>
      </div>

      {showConfidenceInfo ? (
        <div className="modal" onClick={() => setShowConfidenceInfo(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Why “Irregular” and {confidence}% confidence?</h3>
            <div className="output" style={{ margin: 0 }}>
              <p style={{ marginTop: 0 }}>
                <strong>Irregular</strong> is shown when the most recent recorded cycle length is outside the typical range
                (roughly 20–45 days) or missing.
                {typeof lastCycleLength === "number" ? (
                  <>
                    {" "}
                    Your last recorded cycle length is <strong>{lastCycleLength} days</strong>.
                  </>
                ) : null}
              </p>
              <p>
                <strong>Confidence</strong> is based on how stable your cycle lengths are over time and how much history you
                have. More variation and fewer cycles = lower confidence.
              </p>
              <p className="small" style={{ marginBottom: 0 }}>
                Tip: As you log more real cycles consistently, confidence will usually increase and “irregular” may disappear.
              </p>
            </div>
            <div className="modal-actions">
              <button className="button secondary" type="button" onClick={() => setShowConfidenceInfo(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="section">
        <div className="card card--lift">
          <h3>Trends & reminders</h3>

          {!patterns ? (
            <p className="output">Loading insights…</p>
          ) : (
            <div className="output">
              <p>
                <strong>Cycle trend:</strong> {patterns.cycle_trend}
              </p>
              <p>
                <strong>Next period:</strong> {formatRelativeDays(patterns.upcoming_period_days)}
              </p>
              <p>
                <strong>Ovulation window:</strong> {formatRelativeDays(patterns.upcoming_ovulation_days)}
              </p>
              <p>
                <strong>Recurring symptoms:</strong>{" "}
                {patterns.recurring_symptoms.length
                  ? patterns.recurring_symptoms.join(", ")
                  : "No strong patterns yet."}
              </p>
            </div>
          )}

          <button className="button" style={{ marginTop: 16 }} onClick={enableNotifications}>
            {notifEnabled ? "Reminders enabled" : "Enable reminders"}
          </button>
        </div>
      </div>
    </div>
  );
}