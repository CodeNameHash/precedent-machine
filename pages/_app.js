import '../styles/globals.css';
import { UserProvider } from '../lib/useUser';
import { ToastProvider } from '../lib/useToast';
import Layout from '../components/Layout';
import { useEffect } from 'react';

function RecitalApp({ Component, pageProps }) {
  const noLayout = Component.noLayout;

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('pm:escape'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <UserProvider>
      <ToastProvider>
        {noLayout ? (
          <Component {...pageProps} />
        ) : (
          <Layout>
            <Component {...pageProps} />
          </Layout>
        )}
      </ToastProvider>
    </UserProvider>
  );
}

export default RecitalApp;
