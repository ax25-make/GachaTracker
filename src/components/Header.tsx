import { zoneLabel, type Zone } from '../lib/time.ts'
import type { GameConfig } from '../types.ts'

interface Props {
  game: GameConfig
  zone: Zone
  useLocalTime: boolean
  onUseLocalTimeChange: (value: boolean) => void
}

export function Header({ game, zone, useLocalTime, onUseLocalTimeChange }: Props) {
  const serverZone = zoneLabel({ kind: 'fixed', offsetMinutes: game.utcOffsetMinutes })
  return (
    <header className="app-header">
      <div>
        <h1>Gacha Tracker</h1>
        <p className="app-sub">
          {game.name} · {game.server} server ({serverZone})
        </p>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={useLocalTime}
          onChange={(e) => onUseLocalTimeChange(e.target.checked)}
        />
        <span>
          Show as local time
          <span className="toggle-zone">Times shown in {zoneLabel(zone)}</span>
        </span>
      </label>
    </header>
  )
}
