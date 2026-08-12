import { useState } from 'react';
import LeadershipApp from './modules/leadership/LeadershipApp.jsx';
import GovernanceApp from './modules/governance/GovernanceApp.jsx';

export default function App() {
  const [view, setView] = useState('leadership');
  return view === 'leadership'
    ? <LeadershipApp onSwitch={() => setView('governance')} />
    : <GovernanceApp onSwitch={() => setView('leadership')} />;
}
