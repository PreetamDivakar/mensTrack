import React, { useEffect, useState } from "react";
import { getPatterns, getPrediction } from "../services/api";
import { formatDate, formatRelativeDays } from "../utils/date";

export default function Home() {
  const [prediction, setPrediction] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);

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
              {prediction.next_period_estimate && formatDate(new Date(prediction.next_period_estimate))}
            </p>

            <p>
              <strong>Window</strong>
              <br />
              {prediction.prediction_window_start && formatDate(new Date(prediction.prediction_window_start))} — {prediction.prediction_window_end && formatDate(new Date(prediction.prediction_window_end))}
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
              <p className="badge warning">Irregular cycle detected</p>
            ) : (
              <p className="badge success">Regular pattern detected</p>
            )}
          </div>
        )}

        <button className="button" onClick={loadPrediction} style={{ marginTop: 16 }}>
          Refresh Prediction
        </button>
      </div>

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