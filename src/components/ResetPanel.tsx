import { nextOccurrence } from '../lib/resets.ts'
import { formatCountdown, formatDateTime, type Zone } from '../lib/time.ts'
import type { GameConfig } from '../types.ts'

interface Props {
  game: GameConfig
  zone: Zone
  now: number
}

export function ResetPanel({ game, zone, now }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Resets</h2>
      </div>
      <ul className="resets">
        {game.resets.map((rule) => {
          const next = nextOccurrence(rule, game.utcOffsetMinutes, now)
          return (
            <li className="reset-card" key={rule.id}>
              <span className="reset-title">{rule.title}</span>
              <span className="reset-countdown">{formatCountdown(next - now)}</span>
              <span className="reset-when">{formatDateTime(next, zone)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
