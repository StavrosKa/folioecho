import { useId } from 'react';
import Icon from './Icon';
import './metric-hint.css';
export default function MetricHint({ text }: { text: string }) {
  const id = useId();
  return <span className="metric-hint"><button type="button" className="metric-hint-button" aria-label="Explain this number" aria-describedby={id}><Icon name="info" size={14}/></button><span id={id} role="tooltip" className="metric-hint-bubble">{text}</span></span>;
}
