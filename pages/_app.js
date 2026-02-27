import '../styles/globals.css';
import { UserProvider } from '../lib/useUser';
import { ToastProvider } from '../lib/useToast';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

function PrecedentMachine({ Component, pageProps }) {
  const router = useRouter();
  const isLogin = router.pathname === '/login';
  const noLayout = Component.noLayout || isLogin;

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

export default PrecedentMachine;
