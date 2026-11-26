import { useOutletContext } from 'react-router-dom'
import type { Room } from '../state/context'
import DemoSummary from './DemoSummary'
import { SummaryView } from './SummaryView'

// The shared summary for both builds. Reactions, Burak's confirm, edit, remove and add,
// and the export are the demo's abilities: DemoSummary adds them under __DEMO__, so the
// api build holds no demo store code.
export default function Summary() {
  const room = useOutletContext<Room>()
  return __DEMO__ ? <DemoSummary room={room} /> : <SummaryView room={room} />
}
