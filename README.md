# CHS Bell Tracker

A bell schedule app for Coalinga High School teachers. It shows the current period, counts down to the next bell, and sounds an alarm before each class ends so there's time to clean up. It installs to a phone's home screen and keeps working when school wifi drops.

It's plain HTML, CSS and JavaScript, with no build step and nothing to install.

## Features

- **Now / Next panel:** the current period and how long it's been running, plus a countdown to the next bell. Before school it counts down to the first bell; during passing periods it counts down to the next class.
- **Auto or Manual schedule:** Auto picks the schedule by weekday. Manual lets you choose a different schedule from the list (Minimum Day, First Day of School, or No school today). A manual pick lasts only for that day.
- **Cleanup alarm:** sounds before each class ends. A slider sets how early, from 0 to 15 minutes; 0 turns it off.
- **Fixed warnings:** an alarm 5 minutes before Period 1 starts and 5 minutes before lunch ends. These sound even with the cleanup alarm off.
- **Period 2 chime:** a softer chime when Period 2 moves from Breakfast to Reading or Instruction.
- **View Schedules tab:** browse any schedule without changing today's.
- **Alarm ON/OFF, P2 chime and Keep screen on** toggles, plus phone notifications where the browser allows them.

The app has to stay open with the sound on for the alarms to play.

## Recommended setup for teachers

1. **Install the app in Chrome:** go to https://chsbt.netlify.app and click the install icon in the address bar. The installed app opens in its own window.
2. **Turn the sound on:** each time the app opens, click the orange "Sound is off" banner so the alarms can play.
3. **Use a phone as a backup** if you like: install the app on your phone too.

## Schedules

| Schedule | Used |
| --- | --- |
| Regular Day | Auto on Mon, Tue, Fri |
| Wednesday (Late Start) | Auto on Wed |
| Thursday (includes silent reading in Period 2) | Auto on Thu |
| Minimum Day (1:00 Release) | Manual only |
| First Day of School (includes a Rally) | Manual only |

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page layout |
| `app.js` | Schedules, clock, alarms and settings |
| `styles.css` | The look of the app |
| `service-worker.js` | Saves the app on the device so it works offline |
| `manifest.json` | Name and icons for installing to a home screen |
| `alarm.wav`, `chime.wav` | The alarm and Period 2 chime sounds |
| `logo.png`, `icon-*.png`, `favicon.ico` | Logo and app icons |

## Making changes

### Changing bell times

All schedules are at the top of `app.js`, in `SCHEDULES`. Times are 24-hour `"HH:MM"`, so 1:20 PM is `"13:20"`.

- `phases` splits a period into parts (Breakfast, Reading, Instruction). The chime plays when each part after the first begins.
- `noCleanup: true` skips the cleanup alarm for that period.
- `WEEKDAY_SCHEDULES` sets which schedule Auto uses on each weekday.

**Every fall:** check the First Day of School times (`firstday` in `SCHEDULES`) against the new bell sheet. They can change from year to year.

### Changing alarm settings

These are near the top of `app.js`:

- `CLEANUP_MAX_MINUTES`: the highest value on the cleanup slider (now 15)
- `DEFAULT_CLEANUP_MINUTES`: where the slider starts for new users (now 2)
- `WARNING_MINUTES`: lead time for the Period 1 and lunch warnings (now 5)

### After any change: bump the cache version

At the top of `service-worker.js`, raise the number in `CACHE_NAME` (for example, `chs-bell-v14` to `chs-bell-v15`). Without this, phones that already have the app installed keep running the old copy.

If you add a new file the app needs, also add it to `FILES_TO_CACHE` in the same file.

## Testing

**Test mode:** tap the CHS logo 5 times within 3 seconds. A test bar appears that runs today's schedule at 60× speed, starting just before the first warning. A full school day takes about 7 minutes, with every alarm and chime included. Use it to check changes outside school hours.

**Running it on a computer:** open `index.html` in a browser. To test installing and offline use, it needs to be served from a web server instead (for example, run `python3 -m http.server` in this folder and go to `http://localhost:8000`).

## Hosting

The app is live at **https://chsbt.netlify.app**. Netlify publishes it from this GitHub repo, so pushing to `main` updates the site within a minute or two.

Any static web host would work, as long as it uses HTTPS. Phones need HTTPS to install the app and use it offline.
