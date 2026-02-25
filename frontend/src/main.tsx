import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@aws-amplify/ui-react/styles.css';
import { ThemeProvider } from './contexts/ThemeContext';

import { Authenticator } from '@aws-amplify/ui-react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Authenticator.Provider>
        <App />
      </Authenticator.Provider>
    </ThemeProvider>
  </React.StrictMode>
);
