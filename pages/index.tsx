import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

export default function Home() { return null }

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  return {
    redirect: {
      destination: session ? '/dashboard' : '/login',
      permanent: false,
    },
  }
}
