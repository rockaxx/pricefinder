import { db } from '../../lib/db'
import { isAdmin } from '../../lib/admin'
import { categories } from '../../lib/catalog'
import { date } from '../../components/catalog'
import { login, logout, operate } from './actions'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Správa katalógu',
  robots: { index: false, follow: false },
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const state = await searchParams
  if (!(await isAdmin()))
    return (
      <div className="section">
        <h1>Správa katalógu</h1>
        {(process.env.ADMIN_TOKEN?.length ?? 0) >= 24 ? (
          <form className="panel filters narrow" action={login}>
            <label>
              Prístupový kľúč
              <input
                type="password"
                required
                name="token"
                autoComplete="current-password"
              />
            </label>
            <button className="button">Prihlásiť sa</button>
            {state.chyba && <p role="alert">Prihlásenie zlyhalo.</p>}
          </form>
        ) : (
          <p>Správa katalógu vyžaduje nastavený prístupový kľúč.</p>
        )}
      </div>
    )
  const [sources, jobs, products, shops, offers] = await Promise.all([
    db.dataSource.findMany({ orderBy: { name: 'asc' } }),
    db.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { source: true },
    }),
    db.product.findMany({ orderBy: { name: 'asc' } }),
    db.merchant.findMany({ orderBy: { name: 'asc' } }),
    db.offer.findMany({
      where: {
        OR: [
          { productId: null },
          { source: { demo: false } },
          { sourceId: 'sample' },
        ],
      },
      include: { source: true },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  const cmd = (action: string, id: string, label: string) => (
    <form action={operate}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="id" value={id} />
      <button className="button secondary">{label}</button>
    </form>
  )
  return (
    <div className="section">
      <div className="section-head">
        <h1>Správa katalógu</h1>
        <form action={logout}>
          <button className="button secondary">Odhlásiť sa</button>
        </form>
      </div>
      {state.chyba && (
        <p role="alert" className="notice">
          Operácia zlyhala. Pri importe skontroluj denník.
        </p>
      )}
      {state.hotovo && (
        <p role="status" className="notice">
          Operácia dokončená.
        </p>
      )}
      <div className="detail-grid">
        <section className="panel">
          <h2>Testovacie dáta</h2>
          <div className="inline-form">
            {cmd('sample', 'sample', 'Importovať ukážkové XML')}
            {cmd('sample-used', 'demo-used', 'Importovať ukážkový bazár')}
          </div>
        </section>
        <form action={operate} className="panel filters">
          <h2>Pridať schválený zdroj</h2>
          <input type="hidden" name="action" value="source" />
          <label>
            Názov obchodu
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Presná doména obchodu
            <input name="host" placeholder="obchod.sk" required />
          </label>
          <label>
            Formát
            <select name="kind">
              <option value="xml">XML</option>
              <option value="csv">CSV</option>
            </select>
          </label>
          <button className="button">Pridať zdroj</button>
        </form>
      </div>
      <section className="section">
        <h2>Zdroje a aktuálnosť</h2>
        <div className="offer-list">
          {sources.map((s) => (
            <article className="panel admin-row" key={s.id}>
              <div>
                <h3>{s.name}</h3>
                <p>
                  {s.enabled ? 'Zapnutý' : 'Vypnutý'} ·{' '}
                  {s.updatedAt ? date(s.updatedAt) : 'Bez importu'}
                </p>
                {!s.demo && (s.kind === 'xml' || s.kind === 'csv') && (
                  <small>Identifikátor zdroja: {s.id}</small>
                )}
              </div>
              {(s.demo || s.kind === 'xml' || s.kind === 'csv') &&
                cmd('toggle', s.id, s.enabled ? 'Vypnúť' : 'Zapnúť')}
              {s.enabled &&
                !s.demo &&
                (s.kind === 'xml' || s.kind === 'csv') && (
                  <form className="inline-form" action={operate}>
                    <input name="action" type="hidden" value="upload" />
                    <input type="hidden" name="id" value={s.id} />
                    <label>
                      Súbor {s.kind.toUpperCase()}
                      <input
                        name="file"
                        type="file"
                        accept={'.' + s.kind}
                        required
                      />
                    </label>
                    <button className="button">Importovať</button>
                  </form>
                )}
            </article>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Denník importov</h2>
        {jobs.length ? (
          <ul>
            {jobs.map((j) => (
              <li key={j.id}>
                {date(j.createdAt)} · {j.source.name} ·{' '}
                {j.status === 'done'
                  ? j.count + ' položiek'
                  : j.status === 'failed'
                    ? 'Chyba: ' + j.error
                    : 'Prebieha'}
              </li>
            ))}
          </ul>
        ) : (
          <p>Žiadne importy.</p>
        )}
      </section>
      <section className="section">
        <h2>Kontrola párovania</h2>
        {offers.map((o) => (
          <article key={o.id} className="panel">
            <h3>{o.title}</h3>
            <p>
              {o.source.name} · Zhoda {o.confidence} %
            </p>
            <form className="inline-form" action={operate}>
              <input type="hidden" name="action" value="review" />
              <input type="hidden" name="id" value={o.id} />
              <label>
                Produkt
                <select
                  name="productId"
                  required
                  defaultValue={o.productId ?? ''}
                >
                  <option value="">Vyber produkt</option>
                  {products
                    .filter((p) => p.demo === o.source.demo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="button">Priradiť</button>
            </form>
            {!o.source.demo && !o.productId && (
              <details>
                <summary>Vytvoriť nový produkt</summary>
                <form className="filters" action={operate}>
                  <input type="hidden" name="action" value="create-product" />
                  <input type="hidden" name="id" value={o.id} />
                  <label>
                    Názov
                    <input name="name" defaultValue={o.title} required />
                  </label>
                  <label>
                    Značka
                    <input name="brand" required />
                  </label>
                  <label>
                    Model
                    <input name="model" required />
                  </label>
                  <label>
                    Variant
                    <input name="variant" required />
                  </label>
                  <label>
                    EAN / GTIN
                    <input name="gtin" />
                  </label>
                  <label>
                    Kategória
                    <select name="categoryId">
                      {categories.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button">Vytvoriť a priradiť</button>
                </form>
              </details>
            )}
          </article>
        ))}
        {!offers.length && <p>Žiadne položky na kontrolu.</p>}
      </section>
      <div className="detail-grid">
        <details className="panel">
          <summary>Produkty ({products.length})</summary>
          <ul>
            {products.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </details>
        <details className="panel">
          <summary>Obchody ({shops.length})</summary>
          <ul>
            {shops.map((s) => (
              <li key={s.id}>
                {s.name}
                {s.host ? ' · ' + s.host : ''}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
