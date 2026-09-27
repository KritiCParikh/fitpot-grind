# 🏋️ FitPot

Fitness accountability for friend groups. Check in every day or pay into the pot; the pot is split among everyone who showed up.

**Stack (all free, Google-first):** React + Vite PWA · GitHub Pages · Firebase Auth (Google sign-in) · Firestore · Google Apps Script → Google Drive for photos · GitHub Actions · Colab for ML.

```
fitpot/
├── src/                 React app (PWA)
├── public/              icon, static assets
├── apps-script/         Drive photo backend (Google Apps Script)
├── firestore.rules      database security rules
├── ml/                  vision + language model notebooks
└── .github/workflows/   auto-deploy to GitHub Pages
```

## Setup

### 1. Firebase (database + login)
1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Spark / free plan; Analytics optional).
2. **Build → Authentication → Get started → Google** → enable.
3. **Build → Firestore Database → Create database** (production mode, a US region).
4. **Firestore → Rules** → paste `firestore.rules` → Publish.
5. **Project settings → Your apps → Web (`</>`)** → register an app → copy the config values.
6. **Authentication → Settings → Authorized domains** → add `<your-username>.github.io`.

### 2. Run locally
```bash
cp .env.example .env.local   # paste the Firebase values
npm install
npm run dev
```

### 3. Deploy to GitHub Pages
1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions** → add each `VITE_*` value from `.env.example` as a repository secret.
3. Push to `main`. The site appears at `https://<your-username>.github.io/<repo>/`.

### 4. Drive photo backend (later phase)
See the header comment in `apps-script/Code.gs`.

## Roadmap
- [x] Phase 0 — repo, PWA shell, Google sign-in, auto-deploy
- [ ] Phase 1 — groups + passcode join
- [ ] Phase 2 — daily check-in + calendar
- [ ] Phase 3 — pot ledger, balances, leaderboard
- [ ] Phase 4 — camera-only photos → Drive, photo wall
- [ ] Phase 5 — food logging (Open Food Facts)
- [ ] Phase 6 — vision model (scratch → fine-tune → browser)
- [ ] Phase 7 — language model nudges + push notifications

> FitPot tracks informal debts between friends. It does not move money.
