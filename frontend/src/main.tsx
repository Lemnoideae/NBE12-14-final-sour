import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ApiProvider } from './api/ApiProvider';
import { MockGameProvider } from './hooks/useMockGame';

const root = createRoot(document.getElementById('root')!);
// Dev-only capture mode for the growth-stage screenshots (scripts/campus-shots/capture.ts) and the API connection
// check (SCRUM-147). Production builds drop these branches because import.meta.env.DEV is false there.
const devParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
const shotLevel = devParams?.get('campusShot');
if (shotLevel) {
  void import('./components/CampusShot').then(({ CampusShot }) => root.render(<CampusShot level={Number(shotLevel)} />));
} else if (devParams?.has('apiCheck')) {
  void import('./components/ApiCheckScreen').then(({ ApiCheckScreen }) => root.render(<ApiProvider><ApiCheckScreen /></ApiProvider>));
} else {
  root.render(<ApiProvider><MockGameProvider><App /></MockGameProvider></ApiProvider>);
}
