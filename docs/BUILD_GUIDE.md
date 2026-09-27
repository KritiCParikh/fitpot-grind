# FitPot Build Guide

A step-by-step record of how FitPot is built and deployed, from an empty GitHub repo to the finished app. Every phase lists **what was built**, **what you do** (clicks and pastes), **how to check it worked**, and **fixes** for problems we hit.

- **Repo:** https://github.com/KritiCParikh/fitpot-grind
- **Live app:** https://kriticparikh.github.io/fitpot-grind/
- **Firebase project:** `fitpot-grind` (Spark / free plan)

| Phase | What | Status |
|---|---|---|
| 0 | Repo, PWA shell, Google sign-in, auto-deploy | ✅ Done |
| 1 | Groups + passcode join | ✅ Done |
| 2 | Daily check-in + calendar + streaks | ✅ Done |
| 3 | Pot ledger, balances, board, rest days, penalty changes | ✅ Done |
| 4 | Camera-only photos → Google Drive, photo wall | ✅ Built, ready to deploy |
| 5 | Food logging (Open Food Facts) | ⏳ Next |
| 6 | Vision model (scratch → fine-tune → browser) | |
| 7 | Language model nudges + push notifications | |

---

## Stack at a glance

| Layer | Tool | What it does | Cost |
|---|---|---|---|
| Frontend | React + Vite, as a PWA | The screens you tap; installable on phones | Free |
| Hosting | GitHub Pages | Serves the website | Free |
| Version control + deploy | GitHub + GitHub Actions | Stores code; every push to `main` rebuilds and redeploys | Free |
| Login | Firebase Authentication (Google) | "Sign in with Google" | Free |
| Database | Cloud Firestore | Groups, members, check-ins | Free tier |
| Backend | Google Apps Script | Saves photos to Drive (phase 4), scheduled jobs | Free |
| File storage | Google Drive | Workout photos in `FitPot/<member>/<month>/` | Free (15 GB) |
| ML training | Google Colab | Training the vision and language models | Free GPUs |

**Will Firebase ever charge?** Not on the Spark plan. It has no billing account or card, so it can't bill you. If a free limit were ever exceeded, that part of the app would pause until the daily quota resets. Charges are only possible if you upgrade to the Blaze plan yourself.

---

# Phase 0 — Repo, app shell, sign-in, auto-deploy

### What was built
- React + Vite app configured as a PWA (installable, own icon, full screen).
- Google sign-in screen, Today screen, bottom tabs.
- `.github/workflows/deploy.yml`: builds the app and publishes it to GitHub Pages on every push to `main`.
- `firestore.rules`, `apps-script/Code.gs` (Drive backend starter), `ml/README.md`.

### Step 1 — Create the GitHub repo and upload the code
1. On github.com, create a new repo (`fitpot-grind`). No README, no .gitignore.
2. Upload the project files. Either:
   - **Command line:**
     ```bash
     cd fitpot
     git remote add origin https://github.com/KritiCParikh/fitpot-grind.git
     git push -u origin main
     ```
   - **Website:** repo → **Add file → Upload files** → drag the files in → **Commit changes**.
3. ⚠️ Drag-and-drop skips folders starting with a dot (`.github`). If the **Actions** tab later says "Get started with GitHub Actions", see Step 6.

### Step 2 — Turn on GitHub Pages
Repo → **Settings → Pages → Source → GitHub Actions**.

### Step 3 — Create the Firebase project
At [console.firebase.google.com](https://console.firebase.google.com/):
1. **Add project** → name it (`fitpot-grind`) → free Spark plan. Analytics optional.
2. **Authentication → Get started → Google → Enable** → pick a support email → **Save**.
3. **Authentication → Settings → Authorized domains → Add domain** → `kriticparikh.github.io`.
4. **Firestore Database → Create database** → production mode → a US region → **Create**.
5. **Firestore Database → Rules** tab → select all (Ctrl/Cmd + A) → delete → paste the full contents of `firestore.rules` → **Publish**.
   - Firebase's default rules (`allow read, write: if false;`) block everything. Replacing them is required.

### Step 4 — Get the Firebase web config
1. Left sidebar → **Settings** (under Project Overview). Direct link:
   `https://console.firebase.google.com/project/fitpot-grind/settings/general`
2. Scroll to **Your apps** → click **`</>`** (Web).
   - No `</>` icon? Go to **Project Overview** → **+ Add app** → **Web**.
3. Nickname `fitpot-web` → leave "Firebase Hosting" unchecked → **Register app**.
4. You'll see:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "fitpot-grind.firebaseapp.com",
     projectId: "fitpot-grind",
     storageBucket: "fitpot-grind.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```
   You can always find it again under **Settings → Your apps**.

### Step 5 — Add the config as GitHub secrets
1. Repo → **Settings** (repo tab, not your profile) → left sidebar **Secrets and variables → Actions**.
2. **New repository secret** → fill **Name** and **Secret** → **Add secret**. Repeat 6 times.
3. **Secret** = only what's inside the quotes. No quotes, no comma, no spaces.

| Name | Secret (from your config) |
|---|---|
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `VITE_FIREBASE_APP_ID` | appId |

Example (made-up values):
```
Name:    VITE_FIREBASE_API_KEY
Secret:  AIzaSyD4x9Kq2mPl7wR8tYvB3nC6hJ1fG0eZkQs

Name:    VITE_FIREBASE_AUTH_DOMAIN
Secret:  fitpot-grind.firebaseapp.com
```

These values are safe inside a web app; the Firestore rules are what protect the data. Secrets just keep them out of the code.

### Step 6 — Make sure the deploy workflow exists
Open the **Actions** tab.
- If you see **"Get started with GitHub Actions"**, the `.github` folder didn't upload. Click **set up a workflow yourself** → name the file `deploy.yml` → replace the editor contents with the workflow at the end of this guide (Appendix A) → **Commit changes**.

### Step 7 — Deploy
**Actions → Deploy to GitHub Pages → Run workflow**. About a minute later it turns green.

### Step 8 — Open and install
- Open **https://kriticparikh.github.io/fitpot-grind/** in the phone's **browser** (the GitHub app only shows code).
- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** ⋮ → **Install app**.
- It opens full screen from its own icon.

### Check it worked
- Login screen with the lime **FitPot** logo → **Sign in with Google** → Today screen.

### Phase 0 fixes

| Problem | Fix |
|---|---|
| Actions shows "Get started with GitHub Actions" | `.github` folder missing. Step 6. |
| Build fails with **exit code 254** | npm can't find `package.json` at the repo root — files were uploaded inside a `fitpot/` folder. In `deploy.yml`, under the build job's `runs-on: ubuntu-latest`, add `defaults: run: working-directory: fitpot`, and change `path: dist` to `path: fitpot/dist`. (Appendix A shows both.) |
| "Node.js 20 is deprecated" / "ubuntu-latest will migrate" | Harmless GitHub notices. Ignore. |
| "Firebase isn't configured" screen | Secrets missing or misnamed. Check all 6 names exactly (Step 5), then re-run the workflow (Step 7). |
| Sign-in error `auth/unauthorized-domain` | Step 3.3: add `kriticparikh.github.io` to Authorized domains. |
| Already have a site at `kriticparikh.github.io` | No conflict. FitPot lives at `/fitpot-grind/`; the main site is untouched. |

---

# Phase 1 — Groups + passcode join

### What was built
- **Onboarding screen** after sign-in: **Join group** (enter a 6-character passcode) or **Create group** (name + daily penalty).
- Creating a group generates a passcode like `K7QM3X` (no look-alike characters such as 0/O or 1/I).
- **Group tab:** big passcode, **Invite friends** button (share sheet on phones, copies a message on desktop), penalty setting, member list with join dates, **Switch group**.
- Group timezone is saved at creation (from the creator's phone). "Today" and the midnight cutoff use it for everyone.

### How the data is stored (Firestore)
```
users/{uid}                        name, photoURL, groupId
passcodes/{code}                   groupId
groups/{groupId}                   name, passcode, penalty, timezone, createdBy, createdAt
groups/{groupId}/members/{uid}     name, photoURL, joinedAt (server time)
groups/{groupId}/checkins/{date_uid}   uid, date, createdAt (server time)
groups/{groupId}/restdays/{date}       votes {uid: server time}        (phase 3)
groups/{groupId}/penalties/{id}        penalty, effectiveDate, setBy, setAt (phase 3)
groups/{groupId}/photos/{date_uid}     uid, date, fileId (Google Drive), createdAt (phase 4)
```

### Security built into the rules
- Only group members can read the group, its members and check-ins.
- You can only join with the real passcode, and only add yourself.
- Passcodes can be looked up one at a time but never listed.
- Join time is stamped by Google's server and can't be changed later, so nobody can fake a later join date to dodge penalties.

### What you do
**Step 9 — Update the Firestore rules.** Firebase → **Firestore Database → Rules** → select all → delete → paste the new `firestore.rules` → **Publish**.
The rules changed in this phase; the app won't work with the old ones.

**Step 10 — Upload the new code.** See "Uploading an update" below.

### Check it worked
1. Sign in → you see **Join group / Create group**.
2. Create a group ("Morning Grinders", $5) → you land on Today.
3. **Group** tab → passcode shows → **Invite friends**.
4. On a second Google account (or a friend's phone): sign in → **Join group** → enter the passcode → they land in the same group and appear in the member list.

---

# Phase 2 — Daily check-in + calendar

### What was built
- **Today tab**
  - Big **CHECK IN** button with a pop animation and a short vibration on Android. Turns into a ✓ once done.
  - **At stake now:** penalty × members who haven't checked in yet.
  - **If it ended now:** what each person who showed up would earn.
  - **Crew today:** everyone's live status (In ✓ / Not yet), updating in real time as friends check in.
- **Calendar tab**
  - Month grid: **green** = you checked in, **red** = missed, outlined = today (still open), grey = before you joined or future.
  - Tap any day → who checked in, who missed, that day's pot and per-person split.
  - **Current streak** 🔥 (not broken until midnight), **best streak**, **total** workouts.
  - Browse back through earlier months.

### Anti-cheat
- One check-in per person per day (the database refuses a second one).
- Check-ins can't be edited or deleted.
- Each check-in is stamped with **Google's server time**, not the phone's clock. A check-in only counts if that server time falls on the right day in the group's timezone, so changing your phone's clock can't backdate one.

### What you do
Same as Phase 1 (Steps 9–10). Phases 1 and 2 ship together.

### Check it worked
1. Today → tap **CHECK IN** → button becomes ✓, you show as **In ✓**.
2. On a friend's phone, their Today screen updates without refreshing.
3. Calendar → today is green, streak shows 1🔥.
4. Tap today → the day breakdown shows the pot and split.

### Phase 1–2 fixes

| Problem | Fix |
|---|---|
| "Missing or insufficient permissions" | The Firestore rules weren't updated. Step 9. |
| "No group with that passcode" | Check the code (letters are uppercase, no 0/O/1/I). |
| Stuck on "Couldn't open your group" | Tap **Choose a group** and re-join with the passcode. |
| Sign-in popup doesn't open in the installed iPhone app | Open the site once in Safari and sign in there, then use the home-screen app. |

---

# Phase 3 — Pot ledger, balances, board, rest days

### What was built
- **Automatic ledger.** Every finished day is settled from the check-ins; nobody types in amounts and no balance can be edited. The rules for each day:
  - Everyone who missed owes that day's penalty.
  - The pot (missed × penalty) is split evenly among everyone who checked in.
  - If **nobody** checked in, nobody is charged (there's no one to pay).
  - People aren't charged for days before they joined.
  - Amounts are rounded to the cent, so a settle-up can be off by a cent.
- **Board tab** (replaces "coming soon")
  - **Balances:** everyone's net for the month, highest first. The last place gets a 🙈 (the shame board).
  - **Settle up:** who pays whom, using the fewest possible transfers.
  - **Streaks:** current streak and best streak for everyone (looks back 60 days).
  - Totals: pot moved, days settled, rest days. Browse back to earlier months.
  - This month is settled **through yesterday**; today joins the ledger after midnight.
- **Today tab additions:** **Your month** balance, and a **Rest day?** card.
- **Rest-day voting.** Tap **Vote rest**. If more than half the group votes before midnight, the day becomes a rest day and nobody pays. Votes are stamped with Google's server time; a vote cast after the day ends doesn't count. You can take your vote back.
- **Penalty changes** (Group tab). A new penalty always starts **tomorrow**, so today's stakes never change mid-day and past days keep the penalty they had. Every change is logged permanently.
- **Calendar:** rest days show in grey; tapping a day shows that day's penalty and each person's +/− amount.

### Worked example (from the blueprint)
5 friends, $20 penalty. 3 check in, 2 don't → pot = 2 × $20 = **$40** → each of the 3 gets **+$13.33**, each of the 2 gets **−$20**.

### What you do
**Step 11 — Update the Firestore rules.** Firebase → **Firestore Database → Rules** → select all → delete → paste the new `firestore.rules` → **Publish**. New in this phase: rest-day votes and penalty changes. The group's base penalty can no longer be edited directly.

**Step 12 — Upload the new code.** Same as before ("Uploading an update" below): drag in `src`, `docs`, `firestore.rules`, `README.md` → commit.

### Check it worked
1. **Board** tab opens and shows balances (all $0.00 on your first day; real numbers appear after midnight).
2. **Today** → **Vote rest** → the button shows **Voted ✓** and the count goes up. Tap again to take it back.
3. **Group** → set a new penalty → it shows "→ $X from tomorrow"; today's "At stake" doesn't change.
4. The next day, **Board** shows yesterday's result, and **Calendar** → tap yesterday shows the +/− amounts.

### Phase 3 fixes

| Problem | Fix |
|---|---|
| "Missing or insufficient permissions" when voting or changing the penalty | Rules not updated. Step 11. |
| Balances are all $0.00 | Normal on day one. Balances cover finished days only (through yesterday). |
| Settle-up is off by $0.01 | Cent rounding when a pot doesn't split evenly. |

---

# Phase 4 — Camera-only photos → Google Drive, photo wall

### What was built
- **📸 Add workout photo** button on Today (highlighted once you've checked in), and a **Wall** tab.
- **Camera-only.** The app opens the live camera. There's no file picker anywhere, so gallery or old photos can't be posted. Works on phones and on laptops with a webcam. **Flip** switches front/back camera; **Retake** before posting.
- **Watermark** burned into every photo: `FitPot · <name> · <date, time>`.
- **Compressed** to about 300–500 KB (max 1080 px) before upload, so Drive space lasts years.
- **One-time consent screen** before the first photo: shared with the whole group, saved in the organiser's Drive, time-stamped, no location.
- **Saved to Google Drive** of whoever deploys the script: `FitPot/<member name>/<YYYY-MM>/<YYYY-MM-DD_HHmmss>.jpg`.
- **Photo wall:** today's photos by default, **‹ ›** to browse earlier days. Each card shows the member and time.
- Photos are **private in Drive**. The app fetches them through the script, which only hands them to members of the same group, and caches them on the phone so each downloads once.
- One photo per person per day, today only, can't be edited or backdated (server time again).
- Photos are **optional**. Check-in alone still counts.

### How it works
```
Phone camera → watermark + compress → Apps Script (your Google account)
   ↳ checks the Firebase login is real
   ↳ checks, through Firestore's own rules, that the person is in the group
   ↳ saves the JPEG into Drive: FitPot/<name>/<month>/
   ↳ returns the Drive file id
App → writes groups/{id}/photos/{date_uid} pointing at that file id
Wall → asks the script for each photo → shown to group members only
```

### What you do

**Step 13 — Update the Firestore rules.** Firebase → **Firestore Database → Rules** → select all → delete → paste the new `firestore.rules` → **Publish**. (Adds the `photos` collection.)

**Step 14 — Create the Apps Script.** Use the Google account whose Drive should hold the photos.
1. Go to **[script.google.com](https://script.google.com)** → **New project**.
2. Click the title "Untitled project" at the top → rename it `FitPot Drive`.
3. In the editor, `Code.gs` is open. Select all → delete → paste the full contents of `apps-script/Code.gs` from the repo → **Save** (💾 or Ctrl/Cmd + S).

**Step 15 — Add the script properties.**
1. Left sidebar → **⚙️ Project Settings**.
2. Scroll to **Script Properties** → **Add script property**. Add three:

| Property | Value |
|---|---|
| `FIREBASE_API_KEY` | same as your `VITE_FIREBASE_API_KEY` (the `apiKey` from Firebase) |
| `FIREBASE_PROJECT_ID` | `fitpot-grind` |
| `TIMEZONE` | `America/New_York` |

3. **Save script properties**.

**Step 16 — Deploy it as a web app.**
1. Top right → **Deploy → New deployment**.
2. Click the ⚙️ next to "Select type" → **Web app**.
3. Description: `FitPot v1`. **Execute as:** `Me`. **Who has access:** `Anyone`.
4. **Deploy** → **Authorize access** → pick your Google account.
5. You'll see "Google hasn't verified this app". This is normal for your own script. Click **Advanced → Go to FitPot Drive (unsafe)** → **Allow**. (It's asking permission for *your* script to use *your* Drive.)
6. Copy the **Web app URL** (ends in `/exec`).
7. Test it: paste the URL into a browser tab. You should see `{"ok":true,"service":"fitpot-drive","configured":true}`. If `configured` is `false`, recheck Step 15.

**Step 17 — Give the URL to the app.**
1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. **Name:** `VITE_DRIVE_UPLOAD_URL` **Secret:** the `/exec` URL → **Add secret**.

**Step 18 — Upload the new code** (see "Uploading an update"): drag in `src`, `docs`, `apps-script`, `firestore.rules`, `README.md` → commit. The deploy runs automatically and picks up the new secret.

### Check it worked
1. **Wall** tab no longer says "Photos aren't switched on yet".
2. **Today** → **📸 Add workout photo** → consent screen → **I understand** → allow camera → take a photo → **Post to group**.
3. The photo shows on the **Wall**, with the watermark at the bottom.
4. In Google Drive: **FitPot → <your name> → <this month>** has the JPEG.
5. A friend in the group sees your photo on their Wall.

### Changing the script later
Edit `Code.gs` → **Save** → **Deploy → Manage deployments** → ✏️ edit the existing deployment → **Version: New version** → **Deploy**. The URL stays the same, so nothing changes on GitHub. (A *new* deployment would give a new URL.)

### Phase 4 fixes

| Problem | Fix |
|---|---|
| Wall says "Photos aren't switched on yet" | `VITE_DRIVE_UPLOAD_URL` secret missing, or the deploy ran before you added it. Step 17, then **Actions → Run workflow**. |
| "Camera permission was denied" | iPhone: **Settings → Safari → Camera → Allow**. Android Chrome: tap the 🔒 by the address → **Permissions → Camera → Allow**. Then reopen the app. |
| "Not signed in (token rejected)" | `FIREBASE_API_KEY` script property is wrong. Step 15. |
| "Not a member of this group" | `FIREBASE_PROJECT_ID` is wrong, or the Firestore rules weren't updated (Step 13). |
| Upload fails / "Failed to fetch" | Deployment access isn't **Anyone**, or the URL doesn't end in `/exec`. Redo Step 16. |
| Photo card says "Couldn't load" | Script was redeployed as a new deployment (new URL). Update the secret or edit the existing deployment instead. |
| Browser URL test shows a Google sign-in page | **Who has access** isn't set to **Anyone**. |

---

## Uploading an update (website method)

Each update comes as a zip. To apply it:
1. Unzip it on your computer.
2. On GitHub, open the folder where `package.json` lives (the repo root, or `fitpot/` if your files are in that folder).
3. **Add file → Upload files** → drag in the files and folders from the zip (usually the `src` folder, `docs` folder, `firestore.rules` and `README.md`; each update's section says which). Uploading a folder with the same name replaces the files inside it.
4. **Commit changes**. The Actions tab starts a deploy automatically; wait for the green check (about 1 minute).
5. Reload the app. An installed app updates itself on the next open or two.

---

## Appendix A — deploy.yml

If your files are at the repo root, use this as-is. If they're inside a `fitpot/` folder, uncomment the two lines marked 👉.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    # 👉 defaults: { run: { working-directory: fitpot } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_DRIVE_UPLOAD_URL: ${{ secrets.VITE_DRIVE_UPLOAD_URL }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist          # 👉 fitpot/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Appendix B — Run locally (optional)
```bash
cp .env.example .env.local   # paste the Firebase values
npm install
npm run dev                  # opens http://localhost:5173
```
Add `localhost` to Firebase Authorized domains if it isn't there already (it usually is by default).
