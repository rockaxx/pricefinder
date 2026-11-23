'use client'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from './ui/button'
export function SearchBox({
  initial = '',
  suggestions = true,
}: {
  initial?: string
  suggestions?: boolean
}) {
  const [value, setValue] = useState(initial)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (!suggestions || !open || value.trim().length < 2) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/suggestions?q=' + encodeURIComponent(value), {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : []))
        .then(setItems)
        .catch(() => {})
    }, 180)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [value, open, suggestions])
  return (
    <form
      className="search-box"
      action="/vyhladavanie"
      role="search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <Search size={22} />
      <input
        name="q"
        aria-label="Názov produktu"
        placeholder="Skús PlayStation 5"
        value={value}
        maxLength={100}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setItems([])
          setValue(e.target.value)
          setOpen(true)
        }}
      />
      <Button type="submit">Vyhľadať</Button>
      {suggestions && open && value.trim().length >= 2 && items.length > 0 && (
        <ul className="suggestions" aria-label="Návrhy produktov">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={'/produkt/' + p.id}>{p.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
