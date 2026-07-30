import { useState } from "react";

// Helper to get today's date in YYYY-MM-DD format
const getToday = () => new Date().toISOString().split("T")[0];
const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const getCurrentDayIndex = () => new Date().getDay();

function DashboardHome() {
  // --- Demo state for dashboard preview (replace with context/props in real app) ---
  const [weeklyPlans] = useState({
    Sunday: [],
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    // Fill with demo data or fetch from backend/context in real app
  });
  const [completed] = useState({}); // { "Monday-08:00-Task title": true }
  const [reminders] = useState([
    // Example: { title: "Doctor", date: "2025-09-20" }
  ]);
  // -------------------------------------------------------------------------------

  // Calculate today's completion percent
  const todayKey = daysOfWeek[getCurrentDayIndex()];
  const todayTasks = weeklyPlans[todayKey]
    ? weeklyPlans[todayKey].slice().sort((a, b) => a.time.localeCompare(b.time))
    : [];
  const todayTotal = todayTasks.length;
  const todayCompleted = todayTasks.filter(
    (plan) => completed[`${todayKey}-${plan.time}-${plan.title}`]
  ).length;
  const percent =
    todayTotal === 0 ? 0 : Math.round((todayCompleted / todayTotal) * 100);

  // Upcoming reminders (future only, sorted)
  const upcomingReminders = reminders
    .filter((r) => r.date >= getToday())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  // Find the max number of plans in any day for table rows
  const maxPlans = Math.max(...daysOfWeek.map((d) => weeklyPlans[d]?.length || 0), 0);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
        <p className="text-gray-600 mb-4">See your weekly routine, today's progress, and upcoming reminders at a glance.</p>
      </div>

      {/* Tasks completed today */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-blue-700">Today's Task Progress</h2>
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold">{todayCompleted} / {todayTotal} tasks completed</span>
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-500 h-4 rounded-full transition-all"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
          </div>
          <span className="ml-2 font-bold text-blue-700">{percent}%</span>
        </div>
      </div>

      {/* Weekly Table */}
      <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4 text-blue-700">Weekly Routine Table</h2>
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              {daysOfWeek.map((day) => (
                <th
                  key={day}
                  className="px-4 py-2 border-b font-bold text-blue-700 bg-blue-50"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxPlans }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {daysOfWeek.map((day) => {
                  const plans = (weeklyPlans[day] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
                  const plan = plans[rowIdx];
                  return (
                    <td
                      key={day}
                      className="px-4 py-2 border-b border-r align-top"
                    >
                      {plan ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-blue-900">
                            {plan.time} - {plan.title}
                          </span>
                          {plan.description && (
                            <span className="text-gray-600 text-xs">
                              {plan.description}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upcoming Reminders */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-green-700">Upcoming Reminders</h2>
        {upcomingReminders.length === 0 ? (
          <p className="text-gray-500">No upcoming reminders.</p>
        ) : (
          <ul>
            {upcomingReminders.map((r, idx) => (
              <li key={idx} className="mb-2 flex items-center gap-4">
                <span className="font-semibold">{r.title}</span>
                <span className="text-gray-600">{r.date}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DashboardHome;