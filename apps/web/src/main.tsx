import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';
import '@xyflow/react/dist/style.css';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
