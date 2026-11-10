import type { GameConfig } from '../types.ts'

/** Arknights, Global (EN) server. Server time is UTC-7 all year. */
export const arknights: GameConfig = {
  id: 'arknights',
  name: 'Arknights',
  server: 'Global',
  utcOffsetMinutes: -7 * 60,
  resets: [
    {
      id: 'arknights-daily',
      title: 'Daily reset',
      frequency: 'daily',
      hour: 4,
      minute: 0,
    },
    {
      id: 'arknights-weekly',
      title: 'Weekly reset',
      frequency: 'weekly',
      weekday: 1,
      hour: 4,
      minute: 0,
    },
  ],
}
