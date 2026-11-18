/**
 * Shown when Prometheus is opened in a browser tab with nothing stored yet. On an iPhone the
 * home screen app has its own separate storage, so anything logged in the tab would be left behind.
 */
export function InstallFirst({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),3rem)]">
      <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="size-20 rounded-[1.25rem]" />
      <h1 className="mt-6 text-large-title font-bold">Add Prometheus to your home screen first</h1>
      <p className="mt-3 text-body text-label-2">
        Your habits are saved inside the home screen app. Anything you log here in the browser stays behind.
      </p>
      <ol className="mt-8 space-y-5">
        {[
          ['Tap the Share button', 'It is in Safari’s toolbar: a square with an arrow pointing up.'],
          ['Choose Add to Home Screen', 'Leave “Open as Web App” switched on.'],
          ['Open Prometheus from its icon', 'Use it from the home screen from now on.'],
        ].map(([step, detail], index) => (
          <li key={step} className="flex gap-4">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-tint font-rounded font-semibold text-on-tint">
              {index + 1}
            </span>
            <span>
              <span className="block text-body font-semibold">{step}</span>
              <span className="block text-subhead text-label-2">{detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onContinue} className="mt-auto min-h-11 pt-8 text-body text-tint active:opacity-50">
        Continue in the browser anyway
      </button>
    </main>
  )
}
