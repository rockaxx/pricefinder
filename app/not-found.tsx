import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Stránka sa nenašla</h1>
      <Link className="button" href="/">
        Späť na úvod
      </Link>
    </div>
  )
}
