'use client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { euro } from '../lib/domain'
export function History({
  points,
}: {
  points: { id: string; label: string; price: number }[]
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="4 4" />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(n) => euro(n)} />
          <Tooltip formatter={(n) => euro(Number(n))} />
          <Line
            name="Cena produktu"
            dataKey="price"
            type="stepAfter"
            stroke="#7060ef"
            strokeWidth={2}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
      <details>
        <summary>Zobraziť zaznamenané ceny</summary>
        <ul>
          {points.map((point) => (
            <li key={point.id}>
              {point.label} · {euro(point.price)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
