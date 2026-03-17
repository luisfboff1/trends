import { GetServerSideProps } from 'next'

// Deprecated: Tipos de Papel is now managed in /materiais
export default function TiposPapelPage() {
  return null
}

export const getServerSideProps: GetServerSideProps = async () => {
  return { redirect: { destination: '/materiais', permanent: true } }
}
