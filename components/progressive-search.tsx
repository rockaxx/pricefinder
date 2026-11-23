'use client'

import { useEffect, useState } from 'react'
import type { SearchCard, SearchEvent, SearchProps, SearchView } from '../lib/search-results'
import { OfferCard, SearchResultView } from './search-result-view'

export function ProgressiveSearch({ query = '', page = 1, filters = {} }: SearchProps) {
  const [cards, setCards] = useState<SearchCard[]>([])
  const [view, setView] = useState<SearchView>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const url = '/api/search?' + new URLSearchParams({ ...filters, q: query, page: String(page) })

  useEffect(() => {
    const abort = new AbortController()
    async function readResults() {
      const response = await fetch(url, { signal: abort.signal })
      if (!response.ok || !response.body) throw Error('Search could not start')
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      let completed = false
      try {
        while (!abort.signal.aborted) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line || abort.signal.aborted) continue
            const event = JSON.parse(line) as SearchEvent
            if (event.type === 'offer') setCards((items) => [...items, event.card])
            if (event.type === 'done') {
              completed = true
              setView(event.view)
            }
            if (event.type === 'error') throw Error('Search could not finish')
          }
        }
        if (!completed && !abort.signal.aborted) throw Error('Search connection was interrupted')
      } finally {
        await reader.cancel().catch(() => {})
      }
    }
    void readResults().catch(() => { if (!abort.signal.aborted) setFailed(true) })
    return () => abort.abort()
  }, [url, attempt])

  if (view) return <SearchResultView view={view} />
  return (
    <div className="results search-preview-stage">
      <div className="skeleton search-filter-placeholder" aria-hidden="true" />
      <section aria-label="Priebežné výsledky">
        {failed ? (
          <div className="notice" role="alert">
            Vyhľadávanie sa nepodarilo dokončiť.{' '}
            <button className="button secondary" onClick={() => {
              setCards([])
              setFailed(false)
              setAttempt(attempt + 1)
            }}>Skúsiť znova</button>
          </div>
        ) : (
          <p role="status" className="search-progress">
            {query ? 'Hľadáme ponuky v obchodoch…' : 'Načítavame ponuky…'}
            {query && page <= 1 && <span>Ponuky pribúdajú počas vyhľadávania.</span>}
          </p>
        )}
        {cards.length > 0 && (
          <div className="cards search-preview">
            {cards.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>
        )}
        {!cards.length && !failed && (
          <div className="cards" aria-hidden="true">
            {[0, 1, 2].map((index) => <div className="skeleton" key={index} />)}
          </div>
        )}
      </section>
    </div>
  )
}
