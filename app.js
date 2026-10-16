// ============================================================
// CHS Bell Tracker
// Schedule data pulled directly from the CHS bell schedule sheet.
// Times are in 24-hour "HH:MM" for easy comparison against the clock.
//
// `phases` splits a period into parts (breakfast, reading, instruction).
// A chime plays when each part after the first begins.
// ============================================================

const SCHEDULES = {
  regular: {
    short: "Regular", // label for the View Schedules buttons
    label: "Regular Day (Mon / Tue / Fri)",
    periods: [
      { name: "Period 1", start: "07:55", end: "08:44" },
      { name: "Period 2", start: "08:50", end: "09:55", phases: [
        { name: "Breakfast",   start: "08:50", end: "09:06" },
        { name: "Instruction", start: "09:06", end: "09:55" },
      ] },
      { name: "Period 3", start: "10:01", end: "10:50" },
      { name: "Period 4", start: "10:56", end: "11:45" },
      { name: "Period 5", start: "11:51", end: "12:40" },
      { name: "Lunch",    start: "12:40", end: "13:20" },
      { name: "Period 6", start: "13:26", end: "14:15" },
      { name: "Period 7", start: "14:21", end: "15:10" },
    ]
  },
  wednesday: {
    short: "Wednesday",
    label: "Wednesday (Late Start)",
    periods: [
      { name: "Period 1", start: "09:10", end: "09:48" },
      { name: "Period 2", start: "09:54", end: "10:48", phases: [
        { name: "Breakfast",   start: "09:54", end: "10:10" },
        { name: "Instruction", start: "10:10", end: "10:48" },
      ] },
      { name: "Period 3", start: "10:54", end: "11:32" },
      { name: "Period 4", start: "11:38", end: "12:16" },
      { name: "Period 5", start: "12:22", end: "13:00" },
      { name: "Lunch",    start: "13:00", end: "13:40" },
      { name: "Period 6", start: "13:46", end: "14:24" },
      { name: "Period 7", start: "14:30", end: "15:08" },
    ]
  },
  thursday: {
    short: "Thursday",
    label: "Thursday",
    periods: [
      { name: "Period 1", start: "07:55", end: "08:41" },
      { name: "Period 2", start: "08:47", end: "10:10", phases: [
        { name: "Breakfast",   start: "08:47", end: "09:03" },
        { name: "Reading",     start: "09:03", end: "09:24" }, // 20 min silent reading + 1 min transition
        { name: "Instruction", start: "09:24", end: "10:10" },
      ] },
      { name: "Period 3", start: "10:16", end: "11:02" },
      { name: "Period 4", start: "11:08", end: "11:54" },
      { name: "Period 5", start: "12:00", end: "12:46" },
      { name: "Lunch",    start: "12:46", end: "13:26" },
      { name: "Period 6", start: "13:32", end: "14:18" },
      { name: "Period 7", start: "14:24", end: "15:10" },
    ]
  },
  minimum: {
    short: "Minimum",
    label: "Minimum Day (1:00 Release)",
    periods: [
      { name: "Period 1", start: "07:55", end: "08:28" },
      { name: "Period 2", start: "08:33", end: "09:13", phases: [
        { name: "Breakfast",   start: "08:33", end: "08:40" },
        { name: "Instruction", start: "08:40", end: "09:13" },
      ] },
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
    short: "First Day",
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

// Which schedule "Auto" picks for each weekday (0 = Sunday). Weekends have none.
// Minimum and First Day are always picked by hand.
const WEEKDAY_SCHEDULES = { 1: "regular", 2: "regular", 3: "wednesday", 4: "thursday", 5: "regular" };

const ALARM_LEAD_MINUTES = 2; // fire the cleanup alarm this many minutes before each bell
const CHIME_GRACE_SECONDS = 15; // a chime missed by more than this (e.g. the app was paused) is skipped, not played late
const SOUND_LOOKAHEAD_SECONDS = 90; // schedule sounds this far ahead — background tabs may only run timers once a minute
const SOUND_FILES = { alarm: "alarm.wav", chime: "chime.wav" };
const TEST_SPEED = 60; // test mode runs the day this many times faster than real time
const TEST_LEAD_MINUTES = 5; // test mode starts this long before the first bell

const CHOICE_STORAGE_KEY = "chsBellTracker.todayChoice"; // a manual schedule pick, which lasts only for the day it was made
const CHIME_STORAGE_KEY = "chsBellTracker.chimeOn";
const WAKE_STORAGE_KEY = "chsBellTracker.keepScreenOn";

// ---------- State ----------
let alarmsEnabled = true;
let chimesEnabled = readSetting(CHIME_STORAGE_KEY, true);
let keepScreenOn = readSetting(WAKE_STORAGE_KEY, false);
let handledSounds = new Set(); // sounds already scheduled, played, or skipped today, reset at midnight or on schedule change
let pendingSounds = new Map(); // id -> { sound, when, nodes } for sounds on the audio clock that haven't finished
let notifiedSounds = new Set(); // alerts already shown as a notification today
let currentDayKey = null; // tracks which calendar day handledSounds applies to
let audioCtx = null;
let silentBuffer = null;
const soundBuffers = {};
let audioClockOffset = null; // wall clock minus audio clock, to notice when the audio clock stalls
let askedForNotifications = false;
let wakeLock = null;
let wakeLockRequest = null;
let testRun = null; // { simStart, realStart, endMinutes } while a fast-forwarded test day is running
let testTimer = null;
let logoTaps = [];

// ---------- Elements ----------
const scheduleSelect = document.getElementById("scheduleSelect");
const alarmToggle = document.getElementById("alarmToggle");
const chimeToggle = document.getElementById("chimeToggle");
const wakeToggle = document.getElementById("wakeToggle");
const soundBanner = document.getElementById("soundBanner");
const brandLogo = document.getElementById("brandLogo");
const testBar = document.getElementById("testBar");
const testStatus = document.getElementById("testStatus");
const testRunButton = document.getElementById("testRun");
const testCloseButton = document.getElementById("testClose");
const periodListEl = document.getElementById("periodList");
const currentPeriodName = document.getElementById("currentPeriodName");
const currentPeriodTime = document.getElementById("currentPeriodTime");
const currentPeriodElapsed = document.getElementById("currentPeriodElapsed");
const currentPhase = document.getElementById("currentPhase");
const currentPhaseName = document.getElementById("currentPhaseName");
const currentPhaseNext = document.getElementById("currentPhaseNext");
const countdownEl = document.getElementById("countdown");
const nextBellNameEl = document.getElementById("nextBellName");
const tabToday = document.getElementById("tabToday");
const tabBrowse = document.getElementById("tabBrowse");
const todayView = document.getElementById("todayView");
const browseView = document.getElementById("browseView");
const browseChips = document.getElementById("browseChips");
const browseTitle = document.getElementById("browseTitle");
const browseList = document.getElementById("browseList");

// ---------- Clock ----------
// Every time read goes through here so test mode can fast-forward the day.
function currentDate() {
  if (!testRun) return new Date();
  return new Date(testRun.simStart + (Date.now() - testRun.realStart) * TEST_SPEED);
}

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
  const d = currentDate();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function nowSeconds() {
  const d = currentDate();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
}

function todayKey() {
  return currentDate().toDateString(); // e.g. "Wed Sep 17 2026" — changes once per calendar day
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

function readSetting(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : saved === "true";
  } catch (e) {
    return fallback; // localStorage unavailable (e.g. private browsing) — not critical
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) { /* localStorage unavailable (e.g. private browsing) — not critical */ }
}

// ---------- Which schedule applies today ----------
// The picker holds "auto" (by weekday), a schedule key, or "none" (no school).
// Anything other than "auto" is saved with today's date and forgotten tomorrow.
function autoScheduleKey() {
  return WEEKDAY_SCHEDULES[currentDate().getDay()] || null;
}

function activeScheduleKey() {
  const choice = scheduleSelect.value;
  if (choice === "auto") return autoScheduleKey();
  return SCHEDULES[choice] ? choice : null;
}

function loadTodayChoice() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHOICE_STORAGE_KEY));
    if (saved && saved.day === todayKey() && (saved.choice === "none" || SCHEDULES[saved.choice])) {
      return saved.choice;
    }
  } catch (e) { /* missing, malformed, or localStorage unavailable — fall back to auto */ }
  return "auto";
}

function saveTodayChoice(choice) {
  try {
    if (choice === "auto") localStorage.removeItem(CHOICE_STORAGE_KEY);
    else localStorage.setItem(CHOICE_STORAGE_KEY, JSON.stringify({ day: todayKey(), choice }));
  } catch (e) { /* localStorage unavailable (e.g. private browsing) — not critical */ }
}

// ---------- Populate schedule dropdown ----------
function populateSchedules() {
  scheduleSelect.appendChild(new Option("", "auto")); // label filled in by updateAutoLabel()

  const todayOnly = document.createElement("optgroup");
  todayOnly.label = "Today only";
  Object.entries(SCHEDULES).forEach(([key, sched]) => {
    todayOnly.appendChild(new Option(sched.label, key));
  });
  todayOnly.appendChild(new Option("No school today", "none"));
  scheduleSelect.appendChild(todayOnly);
}

function updateAutoLabel() {
  const key = autoScheduleKey();
  scheduleSelect.options[0].textContent = key ? `Auto — ${SCHEDULES[key].short}` : "Auto — Weekend, no school";
}

// ---------- Render period list ----------
// `live` highlights the current period and dims finished ones — used for
// Today only. The View Schedules reference passes false so it stays neutral.
function renderPeriodList(schedule, listEl = periodListEl, live = true) {
  listEl.innerHTML = "";
  if (!schedule) {
    listEl.innerHTML = `<div class="empty-state">No bells today. Pick a schedule above if you need one.</div>`;
    return;
  }
  const nm = nowMinutes();
  schedule.periods.forEach(p => {
    const row = document.createElement("div");
    row.className = "period-row";
    const start = toMinutes(p.start), end = toMinutes(p.end);
    if (live && nm >= start && nm < end) row.classList.add("is-current");
    else if (live && nm >= end) row.classList.add("is-done");
    row.innerHTML = `
      <span class="period-name">${p.name}</span>
      <span class="period-time">${formatClock(p.start)} – ${formatClock(p.end)}<span class="period-duration">${formatDuration(p)}</span></span>
    `;
    if (p.phases) {
      row.classList.add("has-phases");
      row.appendChild(renderPhaseList(p, nm, live));
    }
    listEl.appendChild(row);
  });
}

function renderPhaseList(period, nm, live) {
  const list = document.createElement("div");
  list.className = "phase-list";
  period.phases.forEach(ph => {
    const line = document.createElement("div");
    line.className = "phase-row";
    if (live && nm >= toMinutes(ph.start) && nm < toMinutes(ph.end)) line.classList.add("is-current");
    line.innerHTML = `
      <span class="phase-name">${ph.name}</span>
      <span class="phase-time">${formatClock(ph.start)} – ${formatClock(ph.end)} · ${formatDuration(ph)}</span>
    `;
    list.appendChild(line);
  });
  return list;
}

// ---------- View Schedules (read-only reference) ----------
// Browsing here never touches scheduleSelect, localStorage, or alarm tracking,
// and tick() keeps running underneath, so today's alarms still fire.
function populateBrowseChips() {
  Object.entries(SCHEDULES).forEach(([key, sched]) => {
    const chip = document.createElement("button");
    chip.className = "browse-chip";
    chip.dataset.key = key;
    chip.textContent = sched.short;
    chip.addEventListener("click", () => showBrowseSchedule(key));
    browseChips.appendChild(chip);
  });
}

function showBrowseSchedule(key) {
  const schedule = SCHEDULES[key];
  browseChips.querySelectorAll(".browse-chip").forEach(chip => {
    chip.setAttribute("aria-pressed", String(chip.dataset.key === key));
  });
  const isToday = key === activeScheduleKey();
  browseTitle.textContent = schedule.label + (isToday ? " · Today" : "");
  renderPeriodList(schedule, browseList, false);
}

function showView(view) {
  const browsing = view === "browse";
  todayView.hidden = browsing;
  browseView.hidden = !browsing;
  tabToday.setAttribute("aria-selected", String(!browsing));
  tabBrowse.setAttribute("aria-selected", String(browsing));
  if (browsing) {
    // Always open on today's schedule (or the first one if there's no school today)
    showBrowseSchedule(activeScheduleKey() || Object.keys(SCHEDULES)[0]);
  }
}

// ---------- Now / Next panel ----------
function tick() {
  if (testRun && nowMinutes() >= testRun.endMinutes) {
    stopTest(); // test day is over — back to real time
    return;
  }
  if (!testBar.hidden) updateTestBar();

  const dayKey = todayKey();
  if (dayKey !== currentDayKey) {
    currentDayKey = dayKey;
    // New calendar day — yesterday's manual pick expires and every sound is eligible again
    scheduleSelect.value = loadTodayChoice();
    updateAutoLabel();
    resetSounds();
  }

  const key = activeScheduleKey();
  const schedule = SCHEDULES[key];
  scheduleSounds(key, schedule);

  if (!schedule) {
    currentPeriodName.textContent = "No school today";
    currentPeriodTime.textContent = scheduleSelect.value === "none"
      ? "Alarms are off for today"
      : "Pick a schedule above to use one anyway";
    currentPeriodElapsed.hidden = true;
    currentPhase.hidden = true;
    countdownEl.textContent = "--:--";
    countdownEl.classList.remove("urgent");
    nextBellNameEl.textContent = "—";
    renderPeriodList(null);
    return;
  }

  const nm = nowMinutes();
  const periods = schedule.periods;

  // Find current period (if any)
  const current = periods.find(p => nm >= toMinutes(p.start) && nm < toMinutes(p.end));
  if (current) {
    currentPeriodName.textContent = current.name;
    currentPeriodTime.textContent = `${formatClock(current.start)} – ${formatClock(current.end)} · ${formatDuration(current)}`;
    // Subtle live counter — how far into the current period we are, same
    // mm:ss styling as the "Next bell in" countdown but de-emphasized.
    const elapsedSeconds = Math.max(0, Math.round((nm - toMinutes(current.start)) * 60));
    currentPeriodElapsed.textContent = `${formatCountdown(elapsedSeconds)} elapsed`;
    currentPeriodElapsed.hidden = false;
    updatePhaseLine(current, nm);
  } else {
    currentPeriodName.textContent = "Passing / Out of school hours";
    currentPeriodTime.textContent = "";
    currentPeriodElapsed.hidden = true;
    currentPhase.hidden = true;
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
  } else {
    countdownEl.textContent = "Done";
    countdownEl.classList.remove("urgent");
    nextBellNameEl.textContent = "No more bells today";
  }

  renderPeriodList(schedule);
}

// Inside a period with parts (period 2): which part we're in, time left in
// it, and what comes next — so there's no mental math off the elapsed timer.
function updatePhaseLine(period, nm) {
  const phases = period.phases || [];
  const i = phases.findIndex(ph => nm >= toMinutes(ph.start) && nm < toMinutes(ph.end));
  if (i === -1) {
    currentPhase.hidden = true;
    return;
  }
  const phase = phases[i];
  const next = phases[i + 1];
  if (next) {
    const secondsLeft = Math.max(0, Math.round((toMinutes(phase.end) - nm) * 60));
    currentPhaseName.textContent = `${phase.name} · ${formatCountdown(secondsLeft)} left`;
    currentPhaseNext.textContent = `→ ${next.name} at ${formatClock(next.start)}`;
  } else {
    currentPhaseName.textContent = phase.name;
    currentPhaseNext.textContent = "";
  }
  currentPhase.hidden = false;
}

// ---------- Sounds ----------
// Sounds are scheduled ahead of time on the Web Audio clock instead of being
// played from tick(). Browsers slow timers in background tabs (Chrome to as
// little as once a minute), which can make a timer-based alarm late; the
// audio clock isn't slowed.
function soundEvents(key, schedule) {
  const events = [];
  schedule.periods.forEach(p => {
    if (alarmsEnabled) {
      events.push({
        id: `${key}-cleanup-${p.end}`,
        sound: "alarm",
        at: (toMinutes(p.end) - ALARM_LEAD_MINUTES) * 60,
        until: toMinutes(p.end) * 60, // still worth sounding late, as long as the bell hasn't rung
        title: "Cleanup time",
        body: `${p.name} ends at ${formatClock(p.end)} — 2 minute warning.`,
      });
    }
    if (chimesEnabled && p.phases) {
      p.phases.slice(1).forEach((ph, i) => {
        const at = toMinutes(ph.start) * 60;
        events.push({
          id: `${key}-chime-${ph.start}`,
          sound: "chime",
          at,
          until: at + CHIME_GRACE_SECONDS,
          title: `${ph.name} time`,
          body: `${p.phases[i].name} is over — ${ph.name.toLowerCase()} starts now.`,
        });
      });
    }
  });
  return events;
}

function scheduleSounds(key, schedule) {
  if (!schedule) return;
  checkAudioClock();
  const now = nowSeconds();
  const speed = testRun ? TEST_SPEED : 1; // schedule-time seconds per real second
  for (const ev of soundEvents(key, schedule)) {
    if (handledSounds.has(ev.id) || (ev.at - now) / speed > SOUND_LOOKAHEAD_SECONDS) continue;
    if (now >= ev.until) {
      handledSounds.add(ev.id); // missed it (app was paused or closed) — don't play late
    } else if (audioReady(ev.sound)) {
      handledSounds.add(ev.id);
      playAt(ev, Math.max(0, ev.at - now) / speed);
    } else if (now >= ev.at) {
      // Sound is locked or unavailable — notify now, and still play it if
      // sound gets turned on before `until`
      notify(ev);
    }
  }
}

function audioReady(sound) {
  return audioCtx && audioCtx.state === "running" && soundBuffers[sound];
}

function startBuffer(buffer, when = 0) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(when);
  return source;
}

function playAt(ev, delaySeconds) {
  const when = audioCtx.currentTime + delaySeconds;
  const sound = startBuffer(soundBuffers[ev.sound], when);
  // A silent one-sample cue at the same moment: its "ended" event shows the
  // notification on time, where a timer could fire late in a background tab.
  const cue = startBuffer(silentBuffer, when);
  cue.onended = () => notify(ev);
  sound.onended = () => pendingSounds.delete(ev.id);
  pendingSounds.set(ev.id, { sound: ev.sound, when, nodes: [sound, cue] });
}

// Stop scheduled or playing sounds (optionally just "alarm" or "chime").
// Ones that hadn't started yet become eligible again, so the next tick
// reschedules them against the correct time if they're still wanted.
function cancelPendingSounds(soundType) {
  pendingSounds.forEach(({ sound, when, nodes }, id) => {
    if (soundType && sound !== soundType) return;
    nodes.forEach(node => {
      node.onended = null;
      try { node.stop(); } catch (e) { /* already stopped */ }
    });
    if (when > audioCtx.currentTime) handledSounds.delete(id);
    pendingSounds.delete(id);
  });
}

function resetSounds() {
  cancelPendingSounds();
  handledSounds.clear();
  notifiedSounds.clear();
}

// If the audio clock stopped while real time kept going (laptop asleep,
// iPhone app paused), anything scheduled on it would now play late — cancel
// it and let scheduleSounds() redo it from the real time.
function checkAudioClock() {
  if (!audioCtx) return;
  const offset = Date.now() / 1000 - audioCtx.currentTime;
  if (audioClockOffset !== null && Math.abs(offset - audioClockOffset) > 1) cancelPendingSounds();
  audioClockOffset = offset;
}

function initAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  // iPhone: let alarms play even when the ringer switch is on silent
  if (navigator.audioSession) navigator.audioSession.type = "playback";
  audioCtx = new AudioCtx();
  silentBuffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
  Object.entries(SOUND_FILES).forEach(([name, src]) => {
    fetch(src)
      .then(res => res.arrayBuffer())
      .then(data => audioCtx.decodeAudioData(data))
      .then(buffer => { soundBuffers[name] = buffer; })
      .catch(() => { /* that sound stays unavailable; its alerts fall back to notifications */ });
  });
  audioCtx.addEventListener("statechange", () => {
    if (audioCtx.state !== "running") cancelPendingSounds(); // the audio clock is paused, so scheduled times are no longer right
    updateSoundBanner();
    tick();
  });
  updateSoundBanner();
}

// Browsers only allow sound after the user taps or clicks the page, so any
// tap starts the audio clock (and asks once for notification permission).
function unlockAudio() {
  if (audioCtx && audioCtx.state !== "running") {
    audioCtx.resume().catch(() => {});
    startBuffer(silentBuffer); // iPhone also wants a sound started during the tap
  }
  if (!askedForNotifications) {
    askedForNotifications = true;
    requestNotificationPermission();
  }
  requestWakeLock();
}

function updateSoundBanner() {
  soundBanner.hidden = !audioCtx || audioCtx.state === "running";
}

// ---------- Notifications (secondary backup layer) ----------
function notify(ev) {
  if (notifiedSounds.has(ev.id)) return; // at most one notification per alert
  notifiedSounds.add(ev.id);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const options = { body: ev.body, icon: "icon-192.png", tag: "chs-bell-alarm" };
  // iPhone only shows notifications through the service worker; Chrome supports both
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(ev.title, options)).catch(() => {});
  } else {
    try { new Notification(ev.title, options); } catch (e) { /* not supported here */ }
  }
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// ---------- Keep screen on ----------
// Stops the iPhone from locking (which pauses the app and its alarms) while
// it sits open on a desk. The browser drops the lock whenever the app is
// hidden, so it's re-requested when the app comes back or on the next tap.
async function requestWakeLock() {
  if (!keepScreenOn || wakeLock || wakeLockRequest) return;
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    wakeLockRequest = navigator.wakeLock.request("screen");
    wakeLock = await wakeLockRequest;
    wakeLock.addEventListener("release", () => { wakeLock = null; });
    if (!keepScreenOn) wakeLock.release(); // switched off while the request was pending
  } catch (e) {
    /* refused (e.g. Low Power Mode) — tried again on the next tap */
  } finally {
    wakeLockRequest = null;
  }
}

// ---------- Test mode ----------
// Tap the logo 5 times to open. Runs the picker's schedule at 60× from just
// before the first bell to just after the last, with real alarms and chimes.
function openTestBar() {
  testBar.hidden = false;
  updateTestBar();
}

function updateTestBar() {
  if (testRun) {
    const d = currentDate();
    testStatus.innerHTML = `TEST MODE · ${TEST_SPEED}× speed · not real time<span class="test-clock">${formatClock(`${d.getHours()}:${d.getMinutes()}`)}</span>`;
    testRunButton.hidden = true;
    testCloseButton.textContent = "Stop test";
    return;
  }
  const schedule = SCHEDULES[activeScheduleKey()];
  if (schedule) {
    const periods = schedule.periods;
    const minutes = toMinutes(periods.at(-1).end) - toMinutes(periods[0].start) + TEST_LEAD_MINUTES;
    testStatus.textContent = `TEST MODE · Run ${schedule.short} at ${TEST_SPEED}× (about ${Math.ceil(minutes / TEST_SPEED)} min)`;
  } else {
    testStatus.textContent = "TEST MODE · Pick a schedule above first";
  }
  testRunButton.hidden = false;
  testRunButton.disabled = !schedule;
  testCloseButton.textContent = "Close";
}

function startTest() {
  const schedule = SCHEDULES[activeScheduleKey()];
  if (!schedule) return;
  const periods = schedule.periods;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  testRun = {
    simStart: midnight.getTime() + (toMinutes(periods[0].start) - TEST_LEAD_MINUTES) * 60000,
    realStart: Date.now(),
    endMinutes: toMinutes(periods.at(-1).end) + 1,
  };
  document.body.classList.add("test-running");
  resetSounds();
  testTimer = setInterval(tick, 100); // update often enough that the fast clock looks smooth
  tick();
}

function stopTest() {
  testRun = null;
  clearInterval(testTimer);
  document.body.classList.remove("test-running");
  resetSounds();
  tick();
}

// ---------- Event wiring ----------
scheduleSelect.addEventListener("change", () => {
  saveTodayChoice(scheduleSelect.value);
  resetSounds(); // fresh schedule, fresh alarm tracking
  tick();
});

alarmToggle.addEventListener("click", () => {
  alarmsEnabled = !alarmsEnabled;
  alarmToggle.setAttribute("aria-pressed", String(alarmsEnabled));
  alarmToggle.querySelector(".alarm-label").textContent = alarmsEnabled ? "Alarm ON" : "Alarm OFF";
  cancelPendingSounds("alarm");
  tick();
});

chimeToggle.addEventListener("click", () => {
  chimesEnabled = !chimesEnabled;
  chimeToggle.setAttribute("aria-pressed", String(chimesEnabled));
  saveSetting(CHIME_STORAGE_KEY, chimesEnabled);
  cancelPendingSounds("chime");
  tick();
});

wakeToggle.addEventListener("click", () => {
  keepScreenOn = !keepScreenOn;
  wakeToggle.setAttribute("aria-pressed", String(keepScreenOn));
  saveSetting(WAKE_STORAGE_KEY, keepScreenOn);
  if (keepScreenOn) requestWakeLock();
  else if (wakeLock) wakeLock.release();
});

["touchend", "click", "keydown"].forEach(type => document.addEventListener(type, unlockAudio));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  // Coming back to the app: the iPhone may have paused audio. If resume() isn't
  // allowed without a tap, the sound banner asks for one.
  if (audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  requestWakeLock();
  tick();
});

brandLogo.addEventListener("click", () => {
  const now = Date.now();
  logoTaps = logoTaps.filter(t => now - t < 3000).concat(now);
  if (logoTaps.length >= 5) {
    logoTaps = [];
    openTestBar();
  }
});

testRunButton.addEventListener("click", startTest);
testCloseButton.addEventListener("click", () => {
  if (testRun) stopTest();
  else testBar.hidden = true;
});

tabToday.addEventListener("click", () => showView("today"));
tabBrowse.addEventListener("click", () => showView("browse"));

// ---------- Init ----------
populateSchedules();
populateBrowseChips();
chimeToggle.setAttribute("aria-pressed", String(chimesEnabled));
wakeToggle.setAttribute("aria-pressed", String(keepScreenOn));
wakeToggle.hidden = !("wakeLock" in navigator);
initAudio();
setInterval(tick, 1000);
tick();
requestWakeLock();

// ---------- Service worker (offline support) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* If registration fails (e.g. unsupported host), the app still works online. */
    });
  });
}
