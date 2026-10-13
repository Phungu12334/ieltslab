import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, getThemePref } from './lib/theme';
import './styles.css';

applyTheme(getThemePref());
createRoot(document.getElementById('root')!).render(<App />);
