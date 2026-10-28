import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import Admin from './Admin.tsx';
import PJAssistant from './PJAssistant.tsx';
import './index.css';

const root = createRoot(document.getElementById('root')!);
const path = window.location.pathname.replace(/\/+$/, '') || '/';

if (path === '/pj-control') {
  root.render(<Admin />);
} else if (path === '/' || path === '/assistant') {
  root.render(<PJAssistant />);
} else {
  root.render(<App />);
}
