import type { EventDataFile } from '../types.ts'
import arknightsEvents from './arknights.events.json'

/** Event data per game, keyed by `GameConfig.id`. */
export const eventData: Record<string, EventDataFile> = {
  arknights: arknightsEvents as EventDataFile,
}
