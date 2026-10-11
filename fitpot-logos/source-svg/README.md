# FitPot icon (phase 5.9)

The gullak kettlebell: a clay gullak (piggy bank) shaped like a kettlebell. A check in coin drops into the slot every day, the way the crew fills the pot together.

| File | Used for |
|---|---|
| `icon-large.svg` | The full icon with the coin and painted dots, rounded tile (previews) |
| `icon-large-square.svg` | Source of `icon-192.png`, `icon-512.png` and `apple-touch-icon-180.png` (phones round the corners themselves) |
| `icon-maskable.svg` | Source of `maskable-512.png`: smaller, so Android's circle or squircle crop never cuts it |
| `icon-large-clear.svg` | No background, used on the iPhone start screens |
| `icon-small.svg` | The simple version for tiny sizes: no coin, no dots. Copied to `public/icon.svg` (browser tab) and drawn in the header by `src/nav/Mark.jsx` |
| `badge.svg` | White outline for Android's status bar, source of `badge-96.png` |

Colours: background `#0b0d0c`, handle lime `#c6ff3d`, belly orange `#ff7a1a`.

To change the icon later, edit these files, then export PNGs at the sizes in `public/icons/` and `public/splash/` (any SVG to PNG tool works, for example Inkscape or an online converter).

The PR reward picture is `public/rewards/pr-hanuman.jpg`: Hanuman ji as in the original artwork, with only the gada recoloured gold and the sky toned to FitPot's dark and orange.
