// ============================================================
// CHS Bell Tracker
// Schedule data pulled directly from the CHS bell schedule sheet.
// Times are in 24-hour "HH:MM" for easy comparison against the clock.
// ============================================================

const SCHEDULES = {
  regular: {
    label: "Regular Day (Mon / Tue / Fri)",
    periods: [
      { name: "Period 1", start: "07:55", end: "08:44" },
      { name: "Period 2", start: "08:50", end: "09:55" },
      { name: "Period 3", start: "10:01", end: "10:50" },
      { name: "Period 4", start: "10:56", end: "11:45" },
      { name: "Period 5", start: "11:51", end: "12:40" },
      { name: "Lunch",    start: "12:40", end: "13:20" },
      { name: "Period 6", start: "13:26", end: "14:15" },
      { name: "Period 7", start: "14:21", end: "15:10" },
    ]
  },
  wednesday: {
    label: "Wednesday (Late Start)",
    periods: [
      { name: "Period 1", start: "09:10", end: "09:48" },
      { name: "Period 2", start: "09:54", end: "10:48" },
      { name: "Period 3", start: "10:54", end: "11:32" },
      { name: "Period 4", start: "11:38", end: "12:16" },
      { name: "Period 5", start: "12:22", end: "13:00" },
      { name: "Lunch",    start: "13:00", end: "13:40" },
      { name: "Period 6", start: "13:46", end: "14:24" },
      { name: "Period 7", start: "14:30", end: "15:08" },
    ]
  },
  thursday: {
    label: "Thursday",
    periods: [
      { name: "Period 1", start: "07:55", end: "08:41" },
      { name: "Period 2", start: "08:47", end: "10:10" },
      { name: "Period 3", start: "10:16", end: "11:02" },
      { name: "Period 4", start: "11:08", end: "11:54" },
      { name: "Period 5", start: "12:00", end: "12:46" },
      { name: "Lunch",    start: "12:46", end: "13:26" },
      { name: "Period 6", start: "13:32", end: "14:18" },
      { name: "Period 7", start: "14:24", end: "15:10" },
    ]
  },
  minimum: {
    label: "Minimum Day (1:00 Release)",
    periods: [
      { name: "Period 1", start: "07:55", end: "08:28" },
      { name: "Period 2", start: "08:33", end: "09:13" },
      { name: "Period 3", start: "09:18", end: "09:51" },
      { name: "Period 4", start: "09:56", end: "10:29" },
      { name: "Period 5", start: "10:34", end: "11:07" },
      { name: "Lunch",    start: "11:07", end: "11:42" },
      { name: "Period 6", start: "11:47", end: "12:21" },
      { name: "Period 7", start: "12:26", end: "13:00" },
    ]
  },
  firstday: {
    // This schedule is unique to the first day of school and can change
    // year to year. Update the times below each fall if the school sends
    // a new sheet — everything else in the app stays the same.
    label: "First Day of School",
    periods: [
      { name: "Rally",    start: "07:55", end: "08:25" },
      { name: "Period 1", start: "08:30", end: "08:58" },
      { name: "Period 2", start: "09:03", end: "09:41" },
      { name: "Period 3", start: "09:46", end: "10:14" },
      { name: "Period 4", start: "10:19", end: "10:45" },
      { name: "Period 5", start: "10:50", end: "11:17" },
      { name: "Period 6", start: "11:22", end: "11:50" },
      { name: "Lunch",    start: "11:50", end: "12:25" },
      { name: "Period 7", start: "12:30", end: "13:00" },
    ]
  },
};

const ALARM_LEAD_MINUTES = 2; // fire the cleanup alarm this many minutes before each bell
const SCHEDULE_STORAGE_KEY = "chsBellTracker.selectedSchedule"; // remembers the last-picked schedule across reloads

// ---------- State ----------
let alarmsEnabled = true;
let alarmedKeys = new Set(); // tracks which bells we've already alarmed for today, reset at midnight or on schedule change
let currentDayKey = null; // tracks which calendar day alarmedKeys applies to

// ---------- Elements ----------
const scheduleSelect = document.getElementById("scheduleSelect");
const alarmToggle = document.getElementById("alarmToggle");
const periodListEl = document.getElementById("periodList");
const currentPeriodName = document.getElementById("currentPeriodName");
const currentPeriodTime = document.getElementById("currentPeriodTime");
const countdownEl = document.getElementById("countdown");
const nextBellNameEl = document.getElementById("nextBellName");
const alarmAudio = document.getElementById("alarmAudio");

// ---------- Helpers ----------
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatClock(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function periodLengthMinutes(p) {
  return toMinutes(p.end) - toMinutes(p.start);
}

function formatDuration(p) {
  return `${periodLengthMinutes(p)} min`;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function todayKey() {
  return new Date().toDateString(); // e.g. "Wed Sep 17 2026" — changes once per calendar day
}

function formatCountdown(totalSeconds) {
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

// ---------- Populate schedule dropdown ----------
function populateSchedules() {
  Object.entries(SCHEDULES).forEach(([key, sched]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = sched.label;
    scheduleSelect.appendChild(opt);
  });

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose today's schedule…";
  placeholder.disabled = true;
  placeholder.selected = true;
  scheduleSelect.insertBefore(placeholder, scheduleSelect.firstChild);
}

// ---------- Render period list ----------
function renderPeriodList(schedule) {
  periodListEl.innerHTML = "";
  if (!schedule) {
    periodListEl.innerHTML = `<div class="empty-state">Pick today's schedule to see period times.</div>`;
    return;
  }
  const nm = nowMinutes();
  schedule.periods.forEach(p => {
    const row = document.createElement("div");
    row.className = "period-row";
    const start = toMinutes(p.start), end = toMinutes(p.end);
    if (nm >= start && nm < end) row.classList.add("is-current");
    else if (nm >= end) row.classList.add("is-done");
    row.innerHTML = `
      <span class="period-name">${p.name}</span>
      <span class="period-time">${formatClock(p.start)} – ${formatClock(p.end)}<span class="period-duration">${formatDuration(p)}</span></span>
    `;
    periodListEl.appendChild(row);
  });
}

// ---------- Now / Next panel + alarm check ----------
function tick() {
  const dayKey = todayKey();
  if (dayKey !== currentDayKey) {
    currentDayKey = dayKey;
    alarmedKeys.clear(); // new calendar day — every bell is eligible to alarm again
  }

  const key = scheduleSelect.value;
  const schedule = SCHEDULES[key];

  if (!schedule) {
    currentPeriodName.textContent = "—";
    currentPeriodTime.textContent = "Pick a schedule above";
    countdownEl.textContent = "--:--";
    nextBellNameEl.textContent = "—";
    return;
  }

  const nm = nowMinutes();
  const periods = schedule.periods;

  // Find current period (if any)
  const current = periods.find(p => nm >= toMinutes(p.start) && nm < toMinutes(p.end));
  if (current) {
    currentPeriodName.textContent = current.name;
    currentPeriodTime.textContent = `${formatClock(current.start)} – ${formatClock(current.end)} · ${formatDuration(current)}`;
  } else {
    currentPeriodName.textContent = "Passing / Out of school hours";
    currentPeriodTime.textContent = "";
  }

  // Find next bell (the next end-of-period time still ahead of now)
  let next = null;
  for (const p of periods) {
    const end = toMinutes(p.end);
    if (end > nm) { next = p; break; }
  }

  if (next) {
    const end = toMinutes(next.end);
    const diff = end - nm; // minutes remaining, fractional
    const totalSeconds = Math.max(0, Math.round(diff * 60));
    countdownEl.textContent = formatCountdown(totalSeconds);
    countdownEl.classList.toggle("urgent", diff <= ALARM_LEAD_MINUTES);
    nextBellNameEl.textContent = `${next.name} ends at ${formatClock(next.end)}`;

    // Fire alarm exactly once when we cross the lead-time threshold
    const alarmKey = `${key}-${next.name}-${next.end}`;
    if (alarmsEnabled && diff <= ALARM_LEAD_MINUTES && diff > 0 && !alarmedKeys.has(alarmKey)) {
      alarmedKeys.add(alarmKey);
      fireAlarm(next);
    }
  } else {
    countdownEl.textContent = "Done";
    countdownEl.classList.remove("urgent");
    nextBellNameEl.textContent = "No more bells today";
  }

  renderPeriodList(schedule);
}

// ---------- Alarm ----------
function fireAlarm(period) {
  // Audible alarm — primary alert
  try {
    alarmAudio.currentTime = 0;
    alarmAudio.play().catch(() => {
      /* Autoplay can be blocked until the user has interacted with the page once. */
    });
  } catch (e) { /* no-op */ }

  // Visual/system notification — secondary backup layer
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Cleanup time", {
      body: `${period.name} ends at ${formatClock(period.end)} — 2 minute warning.`,
      icon: "icon-192.png",
      tag: "chs-bell-alarm",
    });
  }
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// ---------- Event wiring ----------
scheduleSelect.addEventListener("change", () => {
  alarmedKeys.clear(); // fresh schedule, fresh alarm tracking
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, scheduleSelect.value);
  } catch (e) { /* localStorage unavailable (e.g. private browsing) — not critical */ }
  // Unlock audio playback on this user gesture so later automatic play() calls work
  alarmAudio.play().then(() => { alarmAudio.pause(); alarmAudio.currentTime = 0; }).catch(() => {});
  requestNotificationPermission();
  tick();
});

alarmToggle.addEventListener("click", () => {
  alarmsEnabled = !alarmsEnabled;
  alarmToggle.setAttribute("aria-pressed", String(alarmsEnabled));
  alarmToggle.querySelector(".alarm-label").textContent = alarmsEnabled ? "Alarm ON" : "Alarm OFF";
});

// ---------- Init ----------
populateSchedules();

// Restore the last schedule the user picked, if any, so reopening the app
// (or refreshing) doesn't force a reselect every time.
try {
  const savedKey = localStorage.getItem(SCHEDULE_STORAGE_KEY);
  if (savedKey && SCHEDULES[savedKey]) {
    scheduleSelect.value = savedKey;
  }
} catch (e) { /* localStorage unavailable (e.g. private browsing) — not critical */ }

renderPeriodList(SCHEDULES[scheduleSelect.value] || null);
setInterval(tick, 1000);
tick();

// ---------- Service worker (offline support) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* If registration fails (e.g. unsupported host), the app still works online. */
    });
  });
}
