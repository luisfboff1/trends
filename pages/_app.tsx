import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Router from 'next/router'
import NProgress from 'nprogress'
import { MainLayout } from '@/components/layout/main-layout'
import { Toaster } from '@/components/ui/toaster'
import { useThemeStore } from '@/store/theme'
import '@/styles/globals.css'

NProgress.configure({ showSpinner: false })
Router.events.on('routeChangeStart', () => NProgress.start())
Router.events.on('routeChangeComplete', () => NProgress.done())
Router.events.on('routeChangeError', () => NProgress.done())

const NO_LAYOUT_PAGES = ['/login', '/aguardando-aprovacao']

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const { theme, setTheme } = useThemeStore()
  const router = useRouter()

  useEffect(() => {
    setTheme(theme)
  }, [])

  const noLayout = NO_LAYOUT_PAGES.includes(router.pathname)

  return (
    <SessionProvider session={session}>
      {noLayout ? (
        <>
          <Component {...pageProps} />
          <Toaster />
        </>
      ) : (
        <MainLayout>
          <Component {...pageProps} />
          <Toaster />
        </MainLayout>
      )}
    </SessionProvider>
  )
}
