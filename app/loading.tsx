export default function Loading() {
  return (
    <div className="section" role="status" aria-label="Načítava sa">
      <div className="skeleton skeleton-title" />
      <div className="cards">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    </div>
  )
}
