import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { ClientProvider } from './contexts/ClientContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClientProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </ClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
