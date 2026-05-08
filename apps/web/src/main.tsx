import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import 'antd/dist/reset.css';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: 'rgba(71, 153, 227, .5)',
          borderRadius: 8,
        },
      }}
    >
      <App />
    </ConfigProvider>
    </StrictMode>
);
