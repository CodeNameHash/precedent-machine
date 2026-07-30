import ProcessPassageCard from './ProcessPassageCard';
import { visibleSlots } from './processResearchView';

export default function ProcessPassageList({ presentation, ...callbacks }) {
  const slots = visibleSlots(presentation);
  return <section aria-label="Process passages" className="space-y-3">{slots.map((slot) => <ProcessPassageCard key={slot.slot_identity} slot={slot} {...callbacks} />)}</section>;
}
