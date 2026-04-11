# Green Up Vermont Dashboard

Read-only data visualization dashboard for Green Up Day, hosted on Firebase Hosting.
Vanilla JS + Leaflet + Chart.js + Firebase v8 compat SDK. No build step.

## Local development

You can't just open `index.html` in a browser. The dashboard relies on Firebase Hosting's
reserved URL `/__/firebase/init.js` to figure out which Firebase project it's
connected to. That URL is only served by `firebase serve` (or a real deploy).

Opening `public/index.html` directly (via `file://` or a plain static server)
will trip the unknown-environment guard and show the "Something's not quite
right" screen instead of the dashboard.

```bash
npx firebase serve --project dev
# → http://localhost:5000
```

## Deployment

Two Firebase projects, two hosting targets:

| Alias  | Project ID             | Used for                      |
| ------ | ---------------------- | ----------------------------- |
| `dev`  | `greenupvermont-dev`   | Day-to-day development        |
| `prod` | `greenupvermont-de02b` | Public-facing production site |

```bash
npx firebase deploy --project dev    # points at greenupvermont-dev
npx firebase deploy --project prod   # live site
```

First-time setup: `npx firebase login`.

## How environment-switching works

The dashboard does **not** carry a `firebaseConfig` object in source. When
deployed to a Firebase Hosting site, Firebase serves a generated script at
`/__/firebase/init.js` that calls `firebase.initializeApp()` with the
_hosting project's own_ config. So:

- deploy to `greenupvermont-dev` → dashboard reads dev Firestore
- deploy to `greenupvermont-de02b` → dashboard reads prod Firestore

## Credentials

The dashboard signs in as a dedicated read-only user
(`dashboard-app@fakeuser.com`) whose email and password are committed to
`public/index.js`. The same credentials work in both dev and prod.
