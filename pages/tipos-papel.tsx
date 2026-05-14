import { GetServerSideProps } from 'next'

// Deprecated: Tipos de Papel is now managed in /materiais
export default function TiposPapelPage() {
  return null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { requireFeature } = await import('@/lib/require-feature')
  const guard = await requireFeature(ctx, 'materiais')
  if (guard) return guard
  return { redirect: { destination: '/materiais', permanent: true } }
}
