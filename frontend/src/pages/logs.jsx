import React, { useState } from "react";
import { addCycle } from "../services/api";

const PROFILE_ID = null;

export default function LogPage() {
  const [startDate, setStartDate] = useState("");
  const [periodLength, setPeriodLength] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await addCycle({
        start_date: startDate,
        period_length: parseInt(periodLength, 10),
      });

      alert("Cycle saved!");
      setStartDate("");
      setPeriodLength("");
    } catch (error) {
      console.error(error);
      alert("Error saving cycle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Log Period</h2>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="section">
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="section">
            <label htmlFor="periodLength">Period Length (days)</label>
            <input
              id="periodLength"
              className="input"
              type="number"
              value={periodLength}
              onChange={(e) => setPeriodLength(e.target.value)}
              min={1}
              max={20}
              required
            />
          </div>

          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>

      <div className="section">
        <p className="small">
          Tip: Log your period as soon as it starts so your shared calendar stays accurate.
        </p>
      </div>
    </div>
  );
}