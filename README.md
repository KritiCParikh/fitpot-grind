# FitPot

Fitness accountability for friend groups. Hit your group's workout target (e.g 4 days a week) or pay into the pot; the pot is split among everyone who showed up.

**Live:** https://kriticparikh.github.io/fitpot-grind/

**Stack (all free, Google-first):** React + Vite PWA · GitHub Pages · Firebase Auth (Google or email sign-in) · Firestore · Google Apps Script -> Google Drive for workout photos · each person's own Drive for progress photos · Indian Nutrient Databank + USDA + Open Food Facts for food · GitHub Actions · Colab for ML.

```
fitpot/
├── src/                 React app (PWA)
├── public/              icon, static assets
├── apps-script/         Drive photo backend (Google Apps Script)
├── firestore.rules      database security rules
├── docs/                BUILD_GUIDE.md (setup) · HOW_IT_WORKS.md (explainer)
├── ml/                  vision + language model notebooks
└── .github/workflows/   auto-deploy to GitHub Pages
```

## Setup

**On your phone:** open the link in your phone's browser. Then install it:

* **iPhone (Safari):** Share -> **Add to Home Screen**
* **Android (Chrome):** ⋮ menu -> **Install app**

It then opens full screen from its own icon, like a normal app.

---

## Roadmap
- [x] Phase 0 : repo, PWA shell, Google sign-in, auto deploy
- [x] Phase 1 : groups + passcode join
- [x] Phase 2 : daily check-in + calendar
- [x] Phase 3 : pot ledger, balances, leaderboard, rest days
- [x] Phase 4 : camera only photos -> Drive, photo wall
- [x] Phase 4.5 : group rules: weekly workout target, photo-required check-in, undo
- [x] Phase 5 : Me tab: food log (India, USA and packaged foods, your own foods and recipes, barcode), targets, weight log, private progress photos
- [x] Phase 5.1 : each member's own timezone (group settles after the last midnight); pot currency ₹ / $ / £ / C$ with conversion at the day's rate
- [x] Phase 5.2 : Me first sign-in, several groups (one check-in for all, Leave), Training tab (progressive overload, PRs, routines, rest timer), body measurements, data export
- [x] Phase 5.3 : email + password sign-in, email verification, Account page (name, password, add a password to Google, delete account)
- [x] Phase 5.4 : kg / lb and km / mi switches, cardio logging (10 activities, pace, records)
- [ ] Phase 5.5 : installable app polish and an Android/ iOS app (on hold)
- [ ] Phase 6 : upcoming AI models (scratch -> fine-tune -> browser) + push notifications + personalizations built on own training data

> FitPot tracks informal debts between friends. It does not move money.
