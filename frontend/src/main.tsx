import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './shared/styles/tokens.css';
import './shared/styles/base.css';
import './shared/styles/ui.css';
import './shared/styles/layout.css';
import { App } from './app/App.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
