import { useMemo } from 'react'
import { Header } from './components/Header.tsx'
import { ResetPanel } from './components/ResetPanel.tsx'
import { Timeline } from './components/Timeline.tsx'
import { eventData } from './data/index.ts'
import { arknights } from './games/arknights.ts'
import { useNow } from './hooks/useNow.ts'
import { useStoredBoolean } from './hooks/useStoredBoolean.ts'
import type { Zone } from './lib/time.ts'

// One game for now. A game picker would replace this constant.
const game = arknights
const data = eventData[game.id]

export default function App() {
  const now = useNow(1000)
  const [useLocalTime, setUseLocalTime] = useStoredBoolean('gachatracker.localTime', true)
  const zone = useMemo<Zone>(
    () => (useLocalTime ? { kind: 'local' } : { kind: 'fixed', offsetMinutes: game.utcOffsetMinutes }),
    [useLocalTime],
  )

  return (
    <div className="app">
      <Header
        game={game}
        zone={zone}
        useLocalTime={useLocalTime}
        onUseLocalTimeChange={setUseLocalTime}
      />
      <main>
        <ResetPanel game={game} zone={zone} now={now} />
        <Timeline events={data.events} zone={zone} now={now} />
      </main>
      <footer className="app-footer">
        <p>
          Event and banner dates from{' '}
          <a href={data.attribution.url} target="_blank" rel="noreferrer">
            {data.attribution.name}
          </a>
          , licensed under{' '}
          <a href={data.attribution.licenseUrl} target="_blank" rel="noreferrer">
            {data.attribution.license}
          </a>
          . Last updated {data.updated}.
        </p>
        <p>A fan-made tool, not affiliated with or endorsed by the game's developer or publisher.</p>
      </footer>
    </div>
  )
}
