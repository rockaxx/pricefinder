'use client'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h1>Stránku sa nepodarilo načítať</h1>
      <button className="button" onClick={reset}>
        Skúsiť znova
      </button>
    </div>
  )
}
