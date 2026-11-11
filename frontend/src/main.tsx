import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { MockGameProvider } from './hooks/useMockGame';

const root = createRoot(document.getElementById('root')!);
// Dev-only capture mode for the growth-stage screenshots (scripts/campus-shots/capture.ts). Production
// builds drop this branch because import.meta.env.DEV is false there.
const shotLevel = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('campusShot') : null;
if (shotLevel) {
  void import('./components/CampusShot').then(({ CampusShot }) => root.render(<CampusShot level={Number(shotLevel)} />));
} else {
  root.render(<MockGameProvider><App /></MockGameProvider>);
}
