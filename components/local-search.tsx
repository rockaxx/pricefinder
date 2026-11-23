import type { SearchProps } from '../lib/search-results'
import { SearchBox } from './search-box'
import { ProgressiveSearch } from './progressive-search'

export function LocalSearch({ query = '', page = 1, filters = {} }: SearchProps) {
  const q = query.trim().slice(0, 100)
  return (
    <section className="section">
      <h1>{q ? 'Výsledky pre „' + q + '“' : 'Vyhľadaj ponuky'}</h1>
      <SearchBox key={q} initial={q} suggestions={false} />
      <ProgressiveSearch key={JSON.stringify([q, page, filters])} query={q} page={page} filters={filters} />
    </section>
  )
}
