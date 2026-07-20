import '../styles/globals.css';
import '../styles/mtx-fonts.css';
import { UserProvider } from '../lib/useUser';
import { ToastProvider } from '../lib/useToast';
import { ViewModeProvider } from '../components/ViewModeContext';
import Layout from '../components/Layout';
import GlobalMarketBridge from '../components/review-v2/GlobalMarketBridge';
import { useEffect } from 'react';

function CorpusApp({ Component, pageProps }) {
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
        <ViewModeProvider>
          {noLayout ? (
            <Component {...pageProps} />
          ) : (
            <Layout>
              <Component {...pageProps} />
            </Layout>
          )}
          <GlobalMarketBridge />
        </ViewModeProvider>
      </ToastProvider>
    </UserProvider>
  );
}

export default CorpusApp;
