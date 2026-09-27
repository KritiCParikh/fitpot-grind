# 🏋️ FitPot

Fitness accountability for friend groups. Check in every day or pay into the pot; the pot is split among everyone who showed up.

**Live:** https://kriticparikh.github.io/fitpot-grind/

📘 **Full step-by-step build guide:** [docs/BUILD_GUIDE.md](docs/BUILD_GUIDE.md), covering every phase, every click, and fixes for common problems.

**Stack (all free, Google-first):** React + Vite PWA · GitHub Pages · Firebase Auth (Google sign-in) · Firestore · Google Apps Script → Google Drive for photos · GitHub Actions · Colab for ML.

```
fitpot/
├── src/                 React app (PWA)
├── public/              icon, static assets
├── apps-script/         Drive photo backend (Google Apps Script)
├── firestore.rules      database security rules
├── docs/                BUILD_GUIDE.md (step-by-step)
├── ml/                  vision + language model notebooks
└── .github/workflows/   auto-deploy to GitHub Pages
```

## Setup

**1. Turn on Pages.** In the repo, go to **Settings → Pages → Source → GitHub Actions**. Your first deploy probably failed because this wasn't set yet.

**2. Create Firebase (about 10 minutes).** At [console.firebase.google.com](https://console.firebase.google.com/):

* **Add project** → name it `fitpot` (free Spark plan).
* **Authentication → Get started → Google → Enable**.
* **Authentication → Settings → Authorized domains → Add** `kriticparikh.github.io`.
* **Firestore Database → Create** (production mode) → **Rules** → paste `firestore.rules` → **Publish**.
* **Project settings → Your apps → Web `</>`** → register the app and copy the configs.

**3. Add secrets.** Take the above configs from Firestore, next in the repo, go to **Settings → Secrets and variables → Actions → New repository secret**. Add each value from the Firebase config:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

**4. Redeploy.** Go to **Actions → Deploy to GitHub Pages → Run workflow**. It turns green in about a minute.

**5. Open it** at **https://kriticparikh.github.io/fitpot-grind/**. If you skipped step 3, you'll see a "Firebase isn't configured" screen, which means the deploy worked.

**On your phone:** open the link in your phone's browser, not the GitHub app. The GitHub app only shows the code. Then install it:

* **iPhone (Safari):** Share → **Add to Home Screen**
* **Android (Chrome):** ⋮ menu → **Install app**

It then opens full screen from its own icon, like a normal app.

---

## Setup details

### Finding Project settings in Firebase
Click **Settings** in the left sidebar, under Project Overview, or open
`https://console.firebase.google.com/project/<project-id>/settings/general`.
Scroll to **Your apps** → click **`</>`** → nickname `fitpot-web` → leave "Firebase Hosting" unchecked → **Register app**. You'll see:

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

### Entering secrets
Add one secret at a time: **Name** = the secret name, **Secret** = the value inside the quotes (no quotes, no comma, no spaces). Click **Add secret**, repeat 6 times.

| Name | Secret (value from your config) |
|---|---|
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `VITE_FIREBASE_APP_ID` | appId |

Example:
```
Name:    VITE_FIREBASE_AUTH_DOMAIN
Secret:  fitpot-grind.firebaseapp.com
```

### Firestore rules
Firebase starts with a default that blocks everything (`allow read, write: if false;`). In **Firestore Database → Rules**, select all, delete, paste the contents of `firestore.rules`, and click **Publish**.

## Troubleshooting

| Problem | Fix |
|---|---|
| Actions tab shows "Get started with GitHub Actions" | The `.github` folder didn't upload (dot-folders get skipped by drag-and-drop and hidden on Mac). Click **set up a workflow yourself**, name it `deploy.yml`, paste the workflow from this repo, commit. |
| Build fails with **exit code 254** | npm can't find `package.json` at the repo root, usually because files were uploaded inside a `fitpot/` folder. In `deploy.yml`, add `defaults: run: working-directory: fitpot` under the build job's `runs-on`, and change `path: dist` to `path: fitpot/dist`. |
| "Node.js 20 is deprecated" / "ubuntu-latest will migrate" warnings | Harmless notices from GitHub; ignore. |
| Sign-in error `auth/unauthorized-domain` | Firebase → **Authentication → Settings → Authorized domains** → add `kriticparikh.github.io`. |
| "Firebase isn't configured" screen | Secrets are missing or misnamed. Check the 6 names exactly, then re-run the workflow. |
| Already have a site at `kriticparikh.github.io` | No conflict. FitPot lives at `/fitpot-grind/`; your main site is untouched. |

## Run locally (optional)
```bash
cp .env.example .env.local   # paste the Firebase values
npm install
npm run dev
```

## Drive photo backend (later phase)
See the header comment in `apps-script/Code.gs`.

## Roadmap
- [x] Phase 0 — repo, PWA shell, Google sign-in, auto-deploy
- [x] Phase 1 — groups + passcode join
- [x] Phase 2 — daily check-in + calendar
- [x] Phase 3 — pot ledger, balances, leaderboard, rest days
- [ ] Phase 4 — camera-only photos → Drive, photo wall
- [ ] Phase 5 — food logging (Open Food Facts)
- [ ] Phase 6 — vision model (scratch → fine-tune → browser)
- [ ] Phase 7 — language model nudges + push notifications

> FitPot tracks informal debts between friends. It does not move money.
