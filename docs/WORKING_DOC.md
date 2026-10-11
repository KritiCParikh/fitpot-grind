# FitPot Working Document

Oct 10, 2026 · @Vedanth

Everything FitPot is made of through Phase 5.8: every file, every service, how they connect, and what you see on screen because of them.

## 1. Where the "New version ready" bar lives

The bar is drawn by `src/components/UpdateBar.jsx`, switched on by one setting in `vite.config.js`, and placed on screen by `src/App.jsx`. Nothing else is involved.

| File | The line that matters | What it does |
| --- | --- | --- |
| `vite.config.js` | `registerType: 'prompt'` | Tells the build to make a service worker that waits for your OK before switching versions. Without it the app would swap silently. |
| `src/components/UpdateBar.jsx` | `useRegisterSW(...)` | Asks the service worker "is a new version waiting?". If yes, shows **New version ready.** with **Later** and **Update**. Also asks GitHub Pages for news every 60 minutes while the app is open. |
| `src/App.jsx` | `<UpdateBar />` at the very bottom of `App()` | Puts the bar on every screen, even the login screen, because it sits outside all the pages. |

**Like you're five:** the app on your phone is a lunchbox packed this morning. When the kitchen (GitHub) makes a new lunch, a helper (the service worker) quietly packs the new lunchbox and puts it next to the old one. The bar is the helper tapping your shoulder: "New lunch is ready. Swap now or later?" Tap **Update** and you get the new one. Nothing you were writing gets thrown away without you saying so.

**The exact path, start to finish**

1. You upload changed files to the `main` branch on GitHub.
2. GitHub Actions runs `deploy.yml`: it builds the app and publishes it to GitHub Pages. You see the green check after about a minute.
3. Your phone opens FitPot (or it is already open and the hourly check fires).
4. The browser fetches `sw.js` from Pages, sees the file list inside has changed, and downloads the new files in the background.
5. The new service worker is installed but told to wait. `needRefresh` becomes true inside `UpdateBar.jsx`.
6. The bar slides up: **New version ready. Later / Update**.
7. **Update** calls `updateServiceWorker(true)`: the new worker takes over and the page reloads into the new version. **Later** hides the bar until the app is opened again.

**Live example:** after Phase 5.8 was uploaded, phones that already had FitPot showed the bar. One tap on **Update** and the Daily reminders card appeared in Account.

## 2. At a glance

&#91;embedded content: FitPot at a glance · GitHub, your phone, Google\]

Read it left to right: GitHub builds and serves the app, your phone runs it, and Google keeps the facts, the photos and the reminders. The only thing that talks to Google without a phone is the hourly reminder robot.

## 3. The big picture in plain words

FitPot has no server of its own. It is a bundle of files that runs inside each friend's phone, and it talks straight to Google services that are free at our size. That is why it costs $0 a month.

**The restaurant story**

| In the restaurant | In FitPot | Real thing |
| --- | --- | --- |
| Recipe book | All the code, with full history | GitHub repo `fitpot-grind` |
| Kitchen that cooks every time a recipe changes | Builds and publishes the app | GitHub Actions, `deploy.yml` |
| Serving counter | Hands out the finished app files | GitHub Pages |
| Customer's table | Where the app actually runs | Your phone's browser, or the installed app |
| Doorman who checks IDs | Sign in with Google or email | Firebase Authentication |
| Shared order book | Groups, check ins, votes, your private logs | Cloud Firestore |
| House rules the order book enforces | Who may read or write each thing | `firestore.rules` |
| Trusted courier | Carries workout photos to storage | Google Apps Script, `Code.gs` |
| Storage room | Holds the photo files | The organiser's Google Drive |
| Friendly coach with an alarm clock | Kind reminders three times a day | GitHub Actions `reminders.yml` + Firebase Cloud Messaging |
| Waiter who keeps a copy of the menu in his pocket | Lets the app open with no signal | Service worker + Firestore offline cache |

**Three ideas hold it all together**

1. **The phone does the work, Google keeps the truth.** Screens, maths (streaks, the pot, PRs) and drawing all happen on the phone. The facts (who checked in, when) live in Firestore.
2. **Nobody is trusted, the rules check everything.** A clever friend could send any request from their phone. Firestore's rules, which run on Google's side, reject anything that breaks the rules, such as checking in as someone else or backdating a check in.
3. **Money is never stored, it is worked out.** Balances are recalculated from check ins every time you open Board. Nobody can type a balance in. If the maths changes, every past week is recalculated the same way for everyone.

**Live example:** Asha checks in at 7:10 AM in New York. Firestore stamps the time with Google's clock. Within a second your Today screen in India shows her as **In**, your Board shows the week moving, and the Wall shows her photo. No page refresh, no server of ours in between.

## 4. Every software, service and account

FitPot uses about 30 tools across five families, all on free plans. The tables say what each one is, what FitPot uses it for, and which files touch it.

### Where the code lives and gets built

| Tool | What it is (simply) | What FitPot uses it for | Files that use it |
| --- | --- | --- | --- |
| GitHub | A website that stores code and every change ever made | Master copy of FitPot, repo `kriticparikh/fitpot-grind`, kept public so Pages stays free | Everything |
| Git | The save point system under GitHub. Each save is a commit | Each upload you make becomes a commit you can roll back to | Everything |
| GitHub Actions | Robots that run when something happens in the repo, or on a timer | Build and publish on every upload; send reminders every hour | `.github/workflows/deploy.yml`, `reminders.yml` |
| GitHub Secrets | A locked box for values the robots need | Firebase keys, Drive script URL, USDA key, Google client id, VAPID key, service account | Read by both workflows |
| GitHub Pages | Free hosting that hands out plain files | Serves the app at `kriticparikh.github.io/fitpot-grind/` | The built `dist/` folder |
| Node.js 22 + npm | JavaScript outside the browser, and its shopping list tool | Runs the build and the reminder script | `package.json`, `scripts/reminders/package.json` |

### What the app is built from

| Tool | What it is (simply) | What FitPot uses it for | Files that use it |
| --- | --- | --- | --- |
| React 19 | Builds screens out of small reusable bricks called components | Every screen, card, button and bar | All `.jsx` files |
| React Router 7 (HashRouter) | Changes the screen when the address changes, without reloading | `#/today`, `#/wall`, `#/?me=food` and so on | `src/App.jsx`, `src/nav/pages.js` |
| Vite 8 | The packer that turns many source files into a few fast ones | `npm run build` makes `dist/` | `vite.config.js`, `index.html` |
| vite-plugin-pwa + Workbox | Adds the app manifest and the service worker | Home screen install, offline files, the update prompt, push handler | `vite.config.js`, `UpdateBar.jsx`, `public/push-sw.js` |
| oxlint | A spell checker for code | Catches mistakes before upload (optional) | `package.json` script `lint` |
| barcode-detector + ZXing | Barcode reading. Android Chrome has it built in; ZXing fills in elsewhere | Scan food packs | `src/components/BarcodeScanner.jsx` |
| Google Fonts (Anton, Inter) | Free fonts loaded from Google | Anton for the scoreboard and big numbers, Inter for text | `index.html`, `src/index.css` |

### Google and Firebase (the backend)

| Tool | What it is (simply) | What FitPot uses it for | Files that use it |
| --- | --- | --- | --- |
| Firebase project `fitpot-grind` (Spark, free) | Google's ready made backend, no card on file | Holds Auth, Firestore and Messaging | `src/firebase.js` |
| Firebase Authentication | The doorman | Google sign in, email and password, verification and reset emails | `src/lib/account.js`, `src/screens/Login.jsx`, `Account.jsx` |
| Cloud Firestore | A live shared notebook in the cloud | Every group record and every private log | `src/hooks.js`, `src/lib/*.js`, `src/lib/privateData.js` |
| Firestore offline cache | A copy of your data kept on the phone | Screens open instantly and work with no signal | `src/firebase.js` (`persistentLocalCache`) |
| Firestore Security Rules | The bouncer at every door | Members only, server time stamps, one check in a day, private data owner only | `firestore.rules` (pasted into the Firebase console) |
| Firebase Cloud Messaging (FCM) | Google's free push notification post office | Delivers the kind reminders | `src/lib/reminders.js`, `public/push-sw.js`, `scripts/reminders/send.mjs` |
| firebase-admin | The staff key version of Firebase, used only by robots | The reminder job reads settings and sends messages | `scripts/reminders/send.mjs` |
| Google Apps Script | Free JavaScript that runs on Google's servers as you | The photo courier: checks the sender, saves to Drive, serves photos back | `apps-script/Code.gs`, `src/lib/photos.js` |
| Google Drive (organiser's) | File storage | Workout photos in `FitPot/<member>/<YYYY-MM>/` | Through `Code.gs` |
| Google Drive API + Google Identity Services | Lets you give FitPot a one room key to your own Drive | Progress photos in your own `FitPot Progress` folder, `drive.file` permission only | `src/lib/myDrive.js`, `src/screens/Progress.jsx` |
| Identity Toolkit + Firestore REST | Google addresses the courier phones to check a wristband | `Code.gs` confirms who sent a photo and that they are in the group | `apps-script/Code.gs` |

### Data sources the app looks things up in

| Tool | What it is (simply) | What FitPot uses it for | Files that use it |
| --- | --- | --- | --- |
| INDB (Indian Nutrient Databank) | 1,014 Indian dishes with nutrition | Bundled inside the app, works offline | `public/data/indb.json`, `src/lib/foods.js` |
| USDA FoodData Central | US government food database (free key) | Generic and US branded foods | `src/lib/foods.js` |
| Open Food Facts | Free worldwide packaged food database | Search by name and barcode lookups | `src/lib/foods.js` |
| Frankfurter, with currency-api as backup | Free daily exchange rates | Pre fills the rate when the pot currency changes | `src/lib/money.js` |

### Getting it onto phones

| Tool | What it is (simply) | What FitPot uses it for | Files that use it |
| --- | --- | --- | --- |
| PWA install (Safari, Chrome) | A website that installs like an app | The way FitPot gets onto iPhone and Android for free (Phase 5.5, Part A) | `vite.config.js` manifest, `index.html`, `InstallCard.jsx`, `public/icons`, `public/splash` |
| PWABuilder (on hold) | Wraps the site into an Android store package | Part B was paused. Files kept for later | `android/README.md`, `android/main-site/` |

**Live example:** when you search "dal" in Food, `foods.js` asks three places at once: the INDB file already on your phone, USDA over the internet, and Open Food Facts. Results show as each one answers, so a slow source never blocks the fast one.

## 5. Every file in the GitHub repo

The repo has about 100 files and about 7,600 lines of code. Think of the folders as rooms in a house: `src/` is where the app lives, `public/` is the front porch everyone can see, `.github/` is the robot garage, `scripts/` is the coach's office, `apps-script/` is the courier's desk, and `docs/` is the manual on the shelf.

### Top level

| File | What it does | Connects to |
| --- | --- | --- |
| `index.html` | The one page the browser loads first. Sets the title, iPhone icon, splash screens, fonts, and an empty `<div id="root">` | Loads `src/main.jsx`, which fills `root` |
| `package.json` | The shopping list: React, Firebase, React Router, barcode detector, Vite, the PWA plugin, oxlint | `npm install` reads it; `package-lock.json` pins exact versions |
| `package-lock.json` | Exact version of every library, so each build is the same | Generated by npm, never edited by hand |
| `vite.config.js` | Build settings: the base path `/fitpot-grind/`, the app manifest (name, colours, icons, long press shortcuts), the service worker (offline files, `push-sw.js`, update prompt) | Read by `npm run build`; produces `dist/sw.js` and `manifest.webmanifest` |
| `firestore.rules` | The rulebook for the database. Pasted into the Firebase console, not run from GitHub | Checked by Google on every read and write from every phone |
| `.gitignore` | Tells Git what never to upload: `node_modules`, `dist`, `.env.local`, the reminder script's installs | Git |
| `README.md` | Front page of the repo with the roadmap | People reading GitHub |

### `.github/workflows/` (the robot garage)

| File | When it runs | What it does |
| --- | --- | --- |
| `deploy.yml` | Every push to `main`, or by hand | Installs, builds with the secrets as `VITE_*` values, uploads `dist/` to GitHub Pages |
| `reminders.yml` | Every hour at 7 minutes past (`'7 * * * *'`), or by hand | Installs `firebase-admin` and runs `scripts/reminders/send.mjs` with the `FIREBASE_SERVICE_ACCOUNT` secret |

### `public/` (copied into the app as is)

| File | What it does |
| --- | --- |
| `icon.svg` | The FitPot logo that scales to any size |
| `icons/icon-192.png`, `icon-512.png` | Home screen icons for Android and the manifest |
| `icons/maskable-512.png` | The icon with safe padding, so Android can crop it into a circle or squircle |
| `icons/apple-touch-icon-180.png` | The iPhone home screen icon |
| `splash/splash-*.png` (9 files) | iPhone start screens, one per screen size. Not cached, iPhones only fetch them at install |
| `data/indb.json` | The Indian food database, so Indian search works offline |
| `push-sw.js` | Added into the service worker. Shows a reminder when a push arrives and opens FitPot when you tap it |

### `src/` entry and plumbing

| File | What it does | Connects to |
| --- | --- | --- |
| `main.jsx` | First code that runs. Applies your saved text size, keeps Android's "Install app" event for later, draws `<App />` | `index.css`, `App.jsx`, `nav/textSize.js`, `InstallCard.jsx` |
| `App.jsx` | The spine. Waits for sign in, loads your profile, builds the header (menu, group switcher, Check in), the routes, swipe, the offline bar and the update bar. `GroupProvider` loads the group you are viewing with its clock and money | `firebase.js`, `hooks.js`, every screen, `nav/*`, `UpdateBar.jsx`, `OfflineBar.jsx` |
| `firebase.js` | Connects to Firebase with the `VITE_FIREBASE_*` values and turns on the offline cache | Used by every file that reads or writes data |
| `hooks.js` | Live listeners: your profile, a group, its members, check ins in a date range, one day's photos, all your groups' names | Firestore `onSnapshot` |
| `groupContext.js` | A shared box so any screen can read the active group without passing it down by hand | `App.jsx` fills it, screens read it |
| `index.css` | Every colour, size and layout: the dark gym look, lime and orange, scoreboard digits, plates, lockers. Sized in `rem` so text size scales all of it | Every screen |

### `src/lib/` (the brains, mostly pure maths)

| File | What it does | Live example |
| --- | --- | --- |
| `account.js` | Google and email sign in, sign up, verification, reset, change or add password, delete account. Turns Firebase errors into plain English | "That password is too short" instead of `auth/weak-password` |
| `clock.js` | Each member's own day in their own timezone, when a day closes for the whole group, timezone changes starting tomorrow | Day closes after the midnight of the member furthest west |
| `dates.js` | Day strings like `2026-10-10`, adding days, Mondays, streaks | "5 day streak" |
| `device.js` | Is the app installed, is it an iPhone, are we online, small local memory | Hides the install card once installed |
| `everywhere.js` | One check in or photo counts in every group you're in. Photo slots `_2`, `_3`, `_4`, shared `shot` id, delete everywhere | One gym photo lands in both your groups |
| `foods.js` | Search INDB, USDA, Open Food Facts and your own foods; barcode lookup; one food shape for all | "Paneer tikka" from INDB, "Greek yogurt" from USDA |
| `group.js` | Create a group with a passcode, join, switch, leave, check in, rest vote, settings that start tomorrow | Passcode avoids 0, O, 1, I, L so it reads out loud easily |
| `image.js` | Shrinks a photo to about 500 KB before upload | Saves Drive space |
| `ledger.js` | The pot maths, daily and weekly modes, rest days, people joining and leaving, settle up | Missed 1 day at $5 → $5 split among those who showed |
| `money.js` | Currencies (₹ $ £ C$), formatting, exchange rate lookup, converting past months | Switch to dollars, last month shows in dollars too |
| `myDrive.js` | Your own Drive for progress photos, with the one room `drive.file` key | Photos go to your Drive, never the organiser's |
| `photos.js` | Talks to the Apps Script courier: upload, fetch, cache on the phone; checks a photo counts on its day | Each photo downloads once, then opens from the phone |
| `privateData.js` | Everything under `private/{you}/`: meals, foods, targets, weight, progress, training, measurements | Food diary for today |
| `reminders.js` | Asks permission, gets this phone's push address (token), saves your three reminder times, sends a sample | Account, Daily reminders, Send a sample now |
| `training.js` | Muscles, equipment, the exercise library, last time, PRs, estimated 1 rep max, weekly sets per muscle, cardio pace | 80 kg x 5 → estimated 1 rep max 93 kg |
| `useLedger.js` | Loads check ins, votes and setting changes, then runs `ledger.js` on them | Board and Calendar |

### `src/nav/` (how you move around, Phase 5.7)

| File | What it does |
| --- | --- |
| `pages.js` | The one list of every page, its section, icon and swipe order. Menu, bottom bar and swipe all read it |
| `LockerMenu.jsx` | The Locker room menu: My locker, Crew, Settings, each door with a live line, plus the safes for what's coming |
| `PageStat.jsx` | Those live lines: "2 of 4 in", "5 day streak", "+$12 this month" |
| `MeBar.jsx` | The barbell at the bottom of Me with four plates: Food, Training, Progress, Targets |
| `TrainingDial.jsx` | Tap Training again: the arc of Log, Muscles, Records, Routines, Setup with the My plan safe |
| `FoodPlate.jsx` | Tap Food again: the dinner plate with Breakfast, Lunch, Dinner, Snacks, My foods, Scan |
| `QuickCheck.jsx` | The Check in button in the header; shows **In** once you're done |
| `useSwipe.js` | Swipe left or right between Me, Today, Calendar, Wall, Board, Group |
| `textSize.js` | Small, Normal, Large, Extra large for the whole app |
| `Icon.jsx` | Simple line icons drawn in code, no emoji |

### `src/screens/` (whole pages)

| File | Page |
| --- | --- |
| `Login.jsx` | Continue with Google, or email and password with create, sign in and forgot password |
| `Me.jsx` | Your private home: picks Food, Training, Progress or Targets from the address and shows the barbell |
| `FoodLog.jsx` | Food diary by meal with totals against targets |
| `Training.jsx` | Log, Muscles, Records, Routines, Setup |
| `Progress.jsx` | Weight log and chart, progress photos |
| `Today.jsx` | CHECK IN, rest vote, your week, the crew list |
| `Calendar.jsx` | Month grid, streaks, day detail |
| `Wall.jsx` | Photo tiles with the scoreboard |
| `Board.jsx` | Balances, settle up, weeks, streaks with the scoreboard |
| `Group.jsx` | Passcode, member lockers, Manager's office, your groups |
| `Account.jsx` | Name, password, reminders, text size, install, sign out, delete |

### `src/components/` (bricks used inside pages)

| File | What it is | Used on |
| --- | --- | --- |
| `UpdateBar.jsx` | New version ready bar | Every screen |
| `OfflineBar.jsx` | "You're offline" strip | Every screen |
| `CameraCapture.jsx` | Live camera only, no gallery, activity tag, sends to every group | Today, Wall, header Check in |
| `Scoreboard.jsx` | Stadium style lit digits that unroll for detail | Wall, Board |
| `Avatar.jsx` | Round photo or initials | Lists, lockers, Wall |
| `JoinCreate.jsx` | Join with passcode or create a group | Group |
| `VerifyBanner.jsx` | "Confirm your email" until verified | Me, Account |
| `InstallCard.jsx` | Install FitPot: one tap on Android, two step guide on iPhone | Me, Account |
| `RemindersCard.jsx` | Daily reminders switch, three times, sample | Account |
| `FoodPicker.jsx` | Full screen food search with tabs | Food |
| `PortionPicker.jsx` | How much: units, grams, servings, live nutrition | Food |
| `BarcodeScanner.jsx` | Camera barcode reader | Food |
| `MyFoodForms.jsx` | Create your own food or build a recipe | Food |
| `WorkoutEditor.jsx` | Log sets, cardio, last time, rest timer, PR screen | Training |
| `ExercisePicker.jsx` | Find or create exercises, filter by muscle and equipment | Training |
| `RestTimer.jsx` | Countdown bar that vibrates | Training |
| `UnitSwitch.jsx` | kg / lb or km / mi switch | Training, Progress, Targets |
| `WeightChart.jsx` | The weight trend line with goal | Progress |
| `Measurements.jsx` | Waist, chest, hips and more | Targets |
| `ExportData.jsx` | Download your data as CSV or JSON | Targets |

### Outside the app

| File | What it does |
| --- | --- |
| `apps-script/Code.gs` | The photo courier. Pasted into script.google.com and deployed as a web app. `doPost` checks the Firebase token and group membership, then uploads or serves; `doGet` says "I'm alive" |
| `scripts/reminders/send.mjs` | The reminder robot's main file: reads everyone's settings, checks their day, sends through FCM, removes dead phone tokens, records `lastSent` |
| `scripts/reminders/plan.mjs` | Pure maths: is a slot due (100 minute window), which kind of message (before check in, after, rest day) |
| `scripts/reminders/messages.mjs` | The kind words, 8 per slot, rotated by day. No guilt, no pot pressure |
| `scripts/reminders/package.json` | The robot's own shopping list: `firebase-admin` |
| `android/README.md`, `android/main-site/` | Parked Part B: Android package notes, `assetlinks.json` and the `_config.yml` that lets Pages publish `.well-known` |
| `ml/README.md` | Plan for Phases 6 and 7: food photo model and language model nudges |
| `docs/BUILD_GUIDE.md` | Step by step setup per phase, steps 1 to 55, with fixes tables |
| `docs/HOW_IT_WORKS.md` | Concepts, journeys, data model, security table, glossary |
| `docs/FEATURES.md` | The master list of every page and feature. Every phase must keep all of it |

### Made by the build, never in the repo

`dist/` (the finished app), `dist/sw.js` (the service worker), `dist/manifest.webmanifest` and `node_modules/` (downloaded libraries). GitHub Actions creates them fresh on every deploy.

## 6. How the app starts: from tapping the icon to the first screen

It takes under a second on a phone that has opened FitPot before, because every file comes from the phone itself and your data comes from the offline copy first.

1. **You tap the FitPot icon.** The phone opens `kriticparikh.github.io/fitpot-grind/` in app mode (no address bar), as set by `display: 'standalone'` in `vite.config.js`. iPhones show a splash image from `public/splash/`.
2. **The service worker answers first.** Instead of asking GitHub Pages, it hands over `index.html` and the JavaScript from the phone's storage. That's why FitPot opens on a plane. At the same time it quietly asks Pages "anything new?" (this is what later shows the update bar).
3. **`index.html` loads `main.jsx`.** It applies your text size from `textSize.js`, saves Android's install offer for `InstallCard.jsx`, and draws `<App />`.
4. **`App.jsx` checks the doorman.** `onAuthStateChanged` asks Firebase Auth "is someone signed in on this phone?" While it waits you see **Loading...**. If nobody is, you get `Login.jsx`. The update bar is drawn either way.
5. **Your profile loads.** `useUserDoc` reads `users/{you}`: your name, `groupIds` (all your groups) and `groupId` (the one you're viewing).
6. **The shell is drawn.** The header (menu, FitPot, group switcher, Check in), the offline bar, swipe handling and the routes. You land on **Me** (`#/`), which works with no group at all.
7. **`GroupProvider` loads your active group** in the background: the group record, its members, timezone changes and currency changes. From those it builds two helpers, `clock` (whose day is it, has a day closed) and `money` (which currency, at what rate). It stores them in `groupContext` so Today, Calendar, Wall and Board can all use them.
8. **Listeners stay open.** Every `onSnapshot` keeps a live line to Firestore. When a friend checks in, Firestore pushes the change and React redraws just that row.
9. **Timezone watch.** If your phone's timezone differs from what the group has for you (you flew to London), `App.jsx` logs a change once. It starts from your next day, so nobody can stretch a day.

**Like you're five:** opening FitPot is like opening your toy box. The toys (the app files) are already inside. You check your name tag (sign in), find your own shelf (Me), and then peek at your team's shelf (the group). A walkie talkie (the listener) stays on so you hear the moment a friend does something.

## 7. The backend: four parts, none of them a server we run

The backend is Firestore with its rules, Firebase Auth, the Apps Script photo courier, and the hourly reminder robot. Each does one job.

### 7.1 Firestore: the shared notebook

Data is stored as **documents** (small records) inside **collections** (folders). Paths read like folders on a computer.

```
users/{uid}                          name, photo, groupId (viewing), groupIds (all), leftGroupIds
passcodes/{CODE}                     groupId                       lookup for joining
groups/{groupId}                     name, passcode, penalty, currency, weeklyTarget, photoRequired, timezone, createdBy
  members/{uid}                      name, photo, timezone, joinedAt (server time), joinedDate, leftAt
  checkins/{date_uid}                uid, date, createdAt (server time)
  photos/{date_uid}[_2|_3|_4]        uid, date, fileId (in Drive), createdAt, slot, shot, activity
  restdays/{date}                    votes { uid: server time }
  targets/{id}  penalties/{id}       permanent logs of setting changes, each with effectiveDate
  tzchanges/{id}  currencies/{id}    permanent logs of timezone and currency switches (with rate)
private/{uid}/                       ONLY you can read or write
  settings/main  settings/training  settings/reminders
  meals  foods  weights  progress  workouts  exercises  routines  measurements  devices
```

**Why check in ids look like `2026-10-10_abc123`:** the date plus your id makes "one check in per person per day" automatic. A second check in would land on the same id, which would be an edit, and the rules forbid edits.

**Live example:** you check in today. Firestore now holds `groups/G7/checkins/2026-10-10_you` with `createdAt` set by Google, not by your phone. Changing your phone's clock to yesterday does nothing.

### 7.2 `firestore.rules`: the bouncer

The rules run on Google's side for every read and write. The app's buttons are only a convenience; the rules are what protect the data.

| Thing | Who can read | Who can write |
| --- | --- | --- |
| Your profile | Any signed in user (name and photo) | Only you |
| Passcode lookup | Fetch one if you know it, never list all | Only the group creator, in the same batch as the group |
| Group | Members | Create: verified email. Change: members may rename and set the photo rule only |
| Members | Members | Add only yourself, with the real passcode and a verified email. Join time and timezone locked. Leave once |
| Check ins | Members | Only yourself, active members, server time, id `<date>_<you>`, photo first if the group needs one. Undo within 24 hours |
| Photos | Members | Only yourself, slots 1 to 4, server time, tag from the list. Delete your own within 24 hours |
| Rest votes | Members | Add or remove only your own vote, server time |
| Target, penalty, timezone, currency logs | Members | Add new entries, never edit or delete |
| `private/{you}/...` | Only you | Only you |

**Like you're five:** the rules are a teacher who reads every note before it goes on the class board. "Is this really your name on it? Is today's date real? Did you bring your photo?" If not, the note goes in the bin.

### 7.3 Firebase Auth: the doorman

You sign in with Google or email and password (`account.js`). Auth gives you a permanent **uid** and a short lived **ID token**, a wristband that proves who you are. Firestore reads the wristband automatically. The photo courier reads it by hand. Email accounts must click the link in the verification email before joining or creating a group; the rules check `email_verified`.

### 7.4 Apps Script `Code.gs`: the photo courier

Workout photos are too big for Firestore, so they go to the organiser's Drive and Firestore only keeps a pointer (`fileId`).

1. The phone sends the photo, the group id and your ID token to the script's `/exec` address (`photos.js`).
2. `verifyFirebaseToken_` asks Google's Identity Toolkit "whose wristband is this?"
3. `isMember_` reads your member record from Firestore **using your own token**, so the rules decide if you're really in.
4. `uploadPhoto_` saves it as `FitPot/<your name>/<YYYY-MM>/<date_time>.jpg` with the group id written in the file's description, and returns the `fileId`.
5. Back on the phone, `everywhere.js` writes the photo record and the check in together in one batch.
6. Showing a photo: `getPhoto_` only hands it out if the file's description says it belongs to your group. `photos.js` then keeps it on the phone so it downloads once.

**Progress photos are different:** they go from your phone straight into **your own** Drive with `myDrive.js`, using a key that only opens files FitPot itself made. The organiser never sees them.

### 7.5 The reminder robot (Phase 5.8)

| Piece | Where | Job |
| --- | --- | --- |
| Permission and token | `src/lib/reminders.js` | Asks to show notifications, gets this phone's push address using the public VAPID key, saves it in `private/{you}/devices` |
| Your times | `RemindersCard.jsx` → `private/{you}/settings/reminders` | On or off, morning, afternoon, evening, your timezone |
| Timer | `.github/workflows/reminders.yml` | Wakes up hourly at 7 past |
| Brain | `scripts/reminders/plan.mjs` | Is a slot due within the last 100 minutes and not sent today? Before check in, after, or a rest day? |
| Words | `scripts/reminders/messages.mjs` | Picks a kind line, rotating by day, filling in name, streak, "3 of 5 are in" |
| Sender | `scripts/reminders/send.mjs` | Sends through FCM with the service account, deletes tokens of phones that are gone, saves `lastSent` |
| Phone side | `public/push-sw.js` | Shows the notification, opens FitPot on tap |

**Live example:** your evening slot is 6:30 PM New York. The 7:07 PM run sees it is due (37 minutes late is inside the 100 minute window), sees you haven't checked in, and sends "Still with you. There's time. Pick something you enjoy and go for it." If you had checked in at noon, you'd get one "nice work" note instead, and nothing else that day.

## 8. The frontend: what you see and which file draws it

Every screen is a React component that reads live data, runs the maths in `src/lib/`, and draws the result with the styles in `index.css`. Screen files never talk to Google directly for maths; they ask the lib files.

### Always on screen

| You see | Drawn by | Fed by |
| --- | --- | --- |
| Menu button, FitPot, group switcher | `App.jsx` (`Shell`, `GroupSwitcher`) | `useGroupsMeta` in `hooks.js` |
| **Check in** button, turns into **In** | `nav/QuickCheck.jsx` | `everywhere.js` (your day in every group) |
| Locker room menu with live lines | `nav/LockerMenu.jsx`, `nav/PageStat.jsx` | `nav/pages.js` list, hooks per line |
| "You're offline" strip | `components/OfflineBar.jsx` | `useOnline` in `device.js` |
| New version ready bar | `components/UpdateBar.jsx` | The service worker |
| Swipe between main pages | `nav/useSwipe.js` | `SWIPE_ORDER` in `pages.js` |

### My locker (private to you)

| Page | Address | File | What powers it |
| --- | --- | --- | --- |
| Me with the barbell | `#/` | `Me.jsx`, `nav/MeBar.jsx` | `privateData.js` |
| Food | `#/?me=food` | `FoodLog.jsx`, `nav/FoodPlate.jsx`, `FoodPicker`, `PortionPicker`, `BarcodeScanner`, `MyFoodForms` | `foods.js`, `privateData.js` |
| Training: Log, Muscles, Records, Routines, Setup | `#/?me=training&t=log` | `Training.jsx`, `nav/TrainingDial.jsx`, `WorkoutEditor`, `ExercisePicker`, `RestTimer` | `training.js` |
| Progress | `#/?me=progress` | `Progress.jsx`, `WeightChart`, `UnitSwitch` | `privateData.js`, `myDrive.js` |
| Targets | `#/?me=targets` | inside `Me.jsx`, `Measurements`, `ExportData` | `privateData.js` |

### Crew (needs a group)

| Page | Address | File | What powers it |
| --- | --- | --- | --- |
| Today | `#/today` | `Today.jsx`, `CameraCapture` | `everywhere.js`, `group.js`, `clock.js` |
| Calendar | `#/calendar` | `Calendar.jsx` | `useLedger.js`, `dates.js` |
| Wall | `#/wall` | `Wall.jsx`, `Scoreboard`, `CameraCapture` | `photos.js`, `everywhere.js` |
| Board | `#/board` | `Board.jsx`, `Scoreboard` | `ledger.js`, `money.js` |
| Group | `#/group` | `Group.jsx`, `JoinCreate` | `group.js`, `money.js` |

### Settings

| Page | Address | File | What powers it |
| --- | --- | --- | --- |
| Account | `#/account` | `Account.jsx`, `RemindersCard`, `InstallCard`, `VerifyBanner` | `account.js`, `reminders.js`, `textSize.js` |
| Login | shown when signed out | `Login.jsx` | `account.js` |

**How the two halves meet.** A screen never stores a copy of the truth. It subscribes, Firestore pushes, the lib file calculates, React draws. For example Board does this every time anything changes:

1. `useLedger.js` subscribes to check ins, rest votes, target, penalty and currency logs.
2. `ledger.js` replays every closed day or week: who was active, who missed, who showed.
3. `money.js` converts the result into the group's current currency.
4. `Board.jsx` draws the balances, and `Scoreboard.jsx` lights up the big numbers.

**Like you're five:** the frontend is the puppet show you watch. The backend is the box of facts behind the curtain. The lib files are the puppeteer reading the facts and moving the puppets. When a fact changes, the puppeteer moves the puppet straight away.

**Coming soon safes** (shown, locked, never hidden): Plate scan in Food (Phase 6), My plan in Training (Phase 8), AI nudges in Crew (Phase 7). They come from the entries with no address in `pages.js`.

## 9. Live journeys: what happens, file by file

Each journey follows one tap from your finger to Google and back to everyone's screen.

### A. You check in with a photo (two groups, photo required)

1. You tap **Check in** in the header (`QuickCheck.jsx`) or **CHECK IN** on Today (`Today.jsx`).
2. `everywhere.js` → `myDayInGroups` works out your day in each group and sees one needs a photo, so `CameraCapture.jsx` opens the live camera. There is no gallery button, so old photos can't be used.
3. You snap, pick the tag **Gym**. `image.js` shrinks it to about 500 KB.
4. `checkInEverywhere` sends a copy to the Apps Script for each group (`photos.js` → `Code.gs`), getting back a `fileId` each.
5. For each group, one batch writes `photos/2026-10-10_you` and `checkins/2026-10-10_you`. The rules check the photo is in the same batch and stamp Google's time.
6. Every friend's listener fires. Their Today shows you **In**, the Wall shows your tile, Board's week moves, and your header button turns into **In**.
7. Tonight's reminder robot sees you're in and sends a single kind "nice work" note instead of a nudge.

### B. You add a second photo later (Phase 5.6)

Tennis at 8 PM. On the Wall you tap **+ Add another photo (1/4)**. It is saved as slot `_2` with the same `shot` id in each group. Your tile now shows **1/2** with dots, and friends swipe to see both. Deleting it from one group removes it from all of them because of the shared `shot`.

### C. A weekly group settles

Group target is 4 days a week, penalty $5, one rest day voted on Wednesday.

1. Sunday ends for everyone only after the midnight of the member furthest west (`clock.js`). Until then Board shows the week as open.
2. `ledger.js` lowers the target to 3 because of the rest day.
3. Riya did 3, Asha did 4, you did 1. You are 2 short, so you owe 2 x $5 = $10.
4. The $10 is split between Riya and Asha, who hit the target: +$5 each.
5. Board shows you at −$10 and **Settle up** suggests the fewest transfers: you pay Riya $5 and Asha $5.

Nothing was ever stored as "$10". Open Board tomorrow and it calculates the same numbers again from the check ins.

### D. A friend in another country

Asha is in New York, you're in India. Each of you gets a full day midnight to midnight on your own phone's clock. Her 11 PM check in counts for her day, even though it is the next morning for you. The group day closes only when Asha's midnight passes, then that day is settled.

### E. Switching the pot to dollars

In Group, Manager's office, someone picks USD. `money.js` fetches today's rate from Frankfurter (say 1 ₹ = 0.012 $), lets you edit it, and saves it to the `currencies` log with the new penalty. From tomorrow every amount, including past months, shows in dollars at that saved rate.

### F. Logging a workout and beating last week

In Training, Log, you add Bench press. `training.js` shows last time: 60 kg x 8. You do 62.5 kg x 8, tick the set, and `RestTimer.jsx` counts down your rest time from Setup, then buzzes. On save you see a PR screen for heaviest weight and estimated 1 rep max. Muscles now shows chest **up** compared with last week. All of it stays in `private/{you}/workouts`; no friend can see it.

### G. Logging food by barcode

Food, tap the plate, Scan. `BarcodeScanner.jsx` reads the code, `foods.js` asks Open Food Facts, `PortionPicker.jsx` lets you choose 1 bar or 40 g, and `privateData.js` saves it to Snacks. The totals bars for calories and protein move at once.

### H. You upload a new version

See section 1: upload, green check, open the app, **New version ready**, tap **Update**.

### I. A reminder arrives

`reminders.yml` wakes at 1:07 PM your time. `plan.mjs` says the afternoon slot is due and you haven't checked in. `messages.mjs` picks "Your crew is moving. 3 of 5 have checked in so far. Join them when it suits you." `send.mjs` sends it through FCM to every phone in `private/{you}/devices`. On your phone, `push-sw.js` shows it; tapping it opens FitPot.

## 10. Secrets and keys: where each value lives

There are 11 values. All 11 sit in GitHub Secrets. Ten go into the build and end up in the app; the eleventh, the service account, is only given to the reminder robot and never reaches a phone. The Apps Script has three settings of its own.

| Value | Where it lives | Used by | Public or private |
| --- | --- | --- | --- |
| `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` (6) | GitHub Secrets → `deploy.yml` → baked into the app | `src/firebase.js` | Ends up public inside the app. That's normal for Firebase: the rules protect the data, not the key |
| `VITE_DRIVE_UPLOAD_URL` | GitHub Secrets | `src/lib/photos.js` | Public address, but useless without a valid group member's token |
| `VITE_USDA_API_KEY` | GitHub Secrets | `src/lib/foods.js` | Public in the app, free key |
| `VITE_GOOGLE_CLIENT_ID` | GitHub Secrets | `src/lib/myDrive.js` | Public by design |
| `VITE_FIREBASE_VAPID_KEY` | GitHub Secrets | `src/lib/reminders.js` | The public half of the push key pair |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Secrets → `reminders.yml` only | `scripts/reminders/send.mjs` | **Truly secret.** Full admin access. Never in the app, never in code |
| Script properties `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `TIMEZONE` | Inside the Apps Script project | `apps-script/Code.gs` | Kept out of the code file |

**Like you're five:** most keys are like your school's address. Everyone can know it, and the guard at the gate (the rules) still decides who gets in. The service account is the head teacher's master key. Only the robot holds it, and it is kept in a locked drawer (GitHub Secrets).

**Where it would go wrong:** if a `VITE_*` secret is missing, the app shows "Firebase isn't configured yet" (`SetupNotice` in `App.jsx`), photos say they aren't switched on, or the reminders card says reminders aren't set up. Add the secret, then rerun the deploy.

## 11. Phase history: 0 to 5.9

Everything below is built and tested as of Phase 5.9. Each phase added to the last; nothing was removed (see `docs/FEATURES.md`).

| Phase | What it added | Main files |
| --- | --- | --- |
| 5.9 | The gullak kettlebell icon in every size (big with the coin, tiny for tabs), mark in the header, white reminder badge, new iPhone start screens, Hanuman ji with the gold gada on the PR screen, fix for the barbell covering Save buttons | public/icons/\*, public/splash/\*, public/rewards/pr-hanuman.jpg, src/nav/Mark.jsx, design/icon/\*, WorkoutEditor.jsx, index.css |
| 5.8 | Kind daily reminders, three a day in your own time, stop after check in, gentle on rest days | `reminders.yml`, `scripts/reminders/*`, `push-sw.js`, `reminders.js`, `RemindersCard.jsx` |
| 5.7 | Bigger text, text size setting, Locker room menu, barbell, training dial, food plate, scoreboard, swipe | `src/nav/*`, `Scoreboard.jsx`, `index.css` |
| 5.6 | Up to 4 photos a day, activity tags, flip tiles on the Wall, delete one photo everywhere | `everywhere.js`, `Wall.jsx`, `CameraCapture.jsx`, rules |
| 5.5 | Installs as an app on iPhone and Android (Part A), offline cache, update prompt, icons, splash, shortcuts | `vite.config.js`, `index.html`, `UpdateBar.jsx`, `OfflineBar.jsx`, `InstallCard.jsx`, `firebase.js` |
| 5.4 | kg or lb, km or mi, cardio logging and pace, no emoji, plain human text | `training.js`, `WorkoutEditor.jsx`, `UnitSwitch.jsx` |
| 5.3 | Email and password sign in, verification, reset, add password, delete account, Account page | `account.js`, `Login.jsx`, `Account.jsx`, `VerifyBanner.jsx`, rules |
| 5.2 | Me first, several groups with one check in, leave a group, Training (progressive overload), measurements, routines, rest timer, export | `everywhere.js`, `Training.jsx`, `training.js`, `Measurements.jsx`, `ExportData.jsx` |
| 5.1 | Each member's own timezone, group day closes after the last midnight, pot currency ₹ $ £ C$ with conversion | `clock.js`, `money.js`, rules |
| 5 | Me tab: food diary with INDB, USDA, Open Food Facts, barcode, recipes, targets, weight, progress photos in your own Drive | `foods.js`, `FoodLog.jsx`, `privateData.js`, `myDrive.js`, `Progress.jsx` |
| 4.5 | Weekly target, photo required rule, undo check in | `ledger.js`, `group.js`, rules |
| 4 | Camera only photos to Google Drive, photo wall | `Code.gs`, `photos.js`, `CameraCapture.jsx`, `Wall.jsx` |
| 3 | Pot ledger, balances, Board, rest day votes, settle up | `ledger.js`, `Board.jsx` |
| 2 | Daily check in and Calendar, server time anti cheat | `Today.jsx`, `Calendar.jsx` |
| 1 | Groups and passcode join | `group.js`, `Group.jsx`, `firestore.rules` |
| 0 | Repo, app shell, Google sign in, auto deploy to Pages | `App.jsx`, `firebase.js`, `deploy.yml` |

**Parked, not started:** Part B Android store package (Phase 5.5), Phase 6 plate scan, Phase 7 AI nudges and friend alerts, Phase 8 personal plans. Moving to Firebase Hosting only matters if the repo is ever made private.

## 12. Glossary, explained like you're five

| Word | Like you're five | In FitPot |
| --- | --- | --- |
| Frontend | The puppet show you watch | Everything in `src/` drawn on your phone |
| Backend | The box of facts behind the curtain | Firestore, Auth, Apps Script, the reminder robot |
| Component | A LEGO brick | `Avatar.jsx`, `Scoreboard.jsx`, a whole screen |
| Route | A tab in a binder | `#/wall`, `#/board` |
| Build | Packing your room into a few neat boxes | `npm run build` makes `dist/` |
| Deploy | Putting the boxes on the shop shelf | `deploy.yml` sends `dist/` to Pages |
| Commit | A save point in a game | Each upload you make to GitHub |
| Service worker | A helper who keeps a spare copy of the app in your pocket | Offline opening, the update bar, showing reminders |
| PWA | A website with its own front door on your home screen | Installed FitPot |
| Manifest | The app's name badge | Name, icon, colours, shortcuts in `vite.config.js` |
| Listener (`onSnapshot`) | A walkie talkie that stays on | Friends' check ins appear in about a second |
| Server timestamp | The school bell's clock, not your watch | `createdAt` on every check in |
| Security rules | The teacher who reads every note first | `firestore.rules` |
| uid | Your permanent name tag number | Your id in every path |
| ID token | A wristband that runs out after an hour | Proves who you are to Firestore and `Code.gs` |
| Access token | A hotel key card for one room | `drive.file` key for your own progress photos |
| Batch | Putting several letters in one envelope, all arrive or none do | Photo and check in written together |
| Derived ledger | Counting the marbles again every time instead of writing the total on the jar | Balances recalculated from check ins |
| Closed day | The day is over for everyone, even the friend furthest west | Only closed days and weeks are settled |
| Push notification | A letter the post office drops in your phone | Kind reminders via FCM |
| VAPID key | The return address on those letters | `VITE_FIREBASE_VAPID_KEY` |
| Service account | The head teacher's master key | `FIREBASE_SERVICE_ACCOUNT`, robot only |
| Cron | An alarm clock for robots | `'7 * * * *'`, every hour at 7 past |
| Offline cache | A photocopy of your notebook kept at home | `persistentLocalCache` in `firebase.js` |
| Progressive overload | Lifting a little more than last time | Last time and beat it in Training |
| Estimated 1 rep max | A guess of the most you could lift once | Epley: weight x (1 + reps ÷ 30) |

## 13. References

- Live app: [kriticparikh.github.io/fitpot-grind](https://kriticparikh.github.io/fitpot-grind/)
- Repo docs: `docs/BUILD_GUIDE.md` (setup steps 1 to 55 and fixes), `docs/HOW_IT_WORKS.md` (concepts and data model), `docs/FEATURES.md` (the master list)
- Firebase console: [console.firebase.google.com](https://console.firebase.google.com/) for Auth, Firestore, Rules and Cloud Messaging
- Apps Script: [script.google.com](https://script.google.com/) for the photo courier
- GitHub Actions: the Actions tab of the repo for Deploy to GitHub Pages and Daily reminders
- Food data: [USDA FoodData Central](https://fdc.nal.usda.gov/), [Open Food Facts](https://world.openfoodfacts.org/)
- Exchange rates: [Frankfurter](https://frankfurter.dev/)
