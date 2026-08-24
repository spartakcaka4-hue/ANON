import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export default function NotFoundPage() {
  return <div className="page"><EmptyState icon={Compass} title="Nothing here" body="This ANON page does not exist." action={<Link className="button" to="/">Return home</Link>} /></div>;
}
