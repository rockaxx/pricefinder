'use client'
import { useActionState } from 'react'
import { Bell } from 'lucide-react'
import { createAlert } from '../app/actions'
import { Button } from './ui/button'
export function AlertForm({ id }: { id: string }) {
  const [message, action, pending] = useActionState(
    createAlert.bind(null, id),
    '',
  )
  return (
    <form className="panel alert-form" action={action}>
      <h2>
        <Bell size={22} /> Cenové upozornenie
      </h2>
      <p>Upozornenie sa vyhodnotí podľa celkovej ceny ponuky na sklade.</p>
      <div className="form-grid">
        <label>
          E-mail
          <input
            type="email"
            name="email"
            maxLength={254}
            placeholder="meno@example.com"
            required
          />
        </label>
        <label>
          Cieľová cena (€)
          <input
            type="number"
            name="target"
            min=".01"
            max="9999999"
            step=".01"
            required
          />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Ukladá sa…' : 'Vytvoriť upozornenie'}
      </Button>
      <div role="status">{message}</div>
    </form>
  )
}
