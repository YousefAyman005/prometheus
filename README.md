# Prometheus

A weekly habit and time tracker for the iPhone home screen. You set a goal per week for each habit (gym 3 days, study 12 hours, sleep 7 to 9 hours on average), log with one tap or a timer, and see whether you did what you aimed for.

It is a web app: free, no account, and everything you log stays on your own phone.

## Install on an iPhone

1. Open **https://yousefayman005.github.io/prometheus/** in Safari.
2. Tap the Share button, then **Add to Home Screen**. Leave **Open as Web App** switched on.
3. Open Prometheus from the home screen icon and use it from there.

Install before you start logging. What you enter in the Safari tab does not carry over to the home screen app.

## Keep a backup

Your data lives only inside the home screen app. Removing the icon, or losing the phone, removes the data. Use **Back up now** in the app to save a file to iCloud Drive or Files every few weeks, and **Restore from a backup** to load it again, for example on a new phone.

## Development

```
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # type-check and build to dist/
npm run icons    # regenerate icons from public/logo.svg
```

Pushing to `main` runs the tests and publishes to GitHub Pages. The app's address must not change: stored data is tied to it, so renaming the repository would strand everyone's history.
