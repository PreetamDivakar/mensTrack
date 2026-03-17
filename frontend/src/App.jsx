import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";

import Home from "./pages/index";
import CalendarPage from "./pages/calendar";
import TodayPage from "./pages/today";
import { startReminderScheduler } from "./utils/reminders";

function App() {
  React.useEffect(() => startReminderScheduler(), []);

  return (
    <BrowserRouter>
      <header className="header">
        <div className="header__inner">
          <div>
            <h1>Jiya’s Cycle Tracker</h1>
          </div>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Home</NavLink>
            <NavLink to="/today" className={({ isActive }) => (isActive ? "active" : "")}>Today</NavLink>
            <NavLink to="/calendar" className={({ isActive }) => (isActive ? "active" : "")}>Calendar</NavLink>
          </nav>
        </div>
      </header>
      <div className="container">
        <main className="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
