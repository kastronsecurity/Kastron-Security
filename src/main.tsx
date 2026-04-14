import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ClientProvider } from './contexts/ClientContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClientProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ClientProvider>
  </StrictMode>,
);
