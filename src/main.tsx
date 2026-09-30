import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import Admin from './Admin.tsx';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(window.location.pathname === '/pj-control' ? <Admin /> : <App />);
