# FitPot Android app

The Android app is a thin wrapper (a "Trusted Web Activity") around the live
site at https://kriticparikh.github.io/fitpot-grind/. It runs in Chrome without
the address bar, so Google sign-in, the camera, barcode scanning and Drive all
work exactly as on the website. New code you upload reaches the app on its own;
you only rebuild the APK to change its name, icon or package details.

It's built with PWABuilder (free, in the browser). Step by step instructions are
in docs/BUILD_GUIDE.md, Phase 5.5.

Settings used:

| Setting | Value |
|---|---|
| Package ID | io.github.kriticparikh.fitpot |
| App name | FitPot |
| Host | kriticparikh.github.io |
| Start URL | /fitpot-grind/ |
| Signing key | New (first time), then Mine (reuse it for every rebuild) |

`main-site/` holds the two files that go into the separate `kriticparikh.github.io`
repo so Android trusts the app:

- `_config.yml`: tells GitHub Pages to publish the hidden `.well-known` folder.
- `.well-known/assetlinks.json`: replace it with the one PWABuilder gives you.

Keep the `signing.keystore` and `signing-key-info.txt` from PWABuilder somewhere
safe (not in this repo). Without them you can't publish an update that installs
over the old app.
