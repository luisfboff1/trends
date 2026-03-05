import { useRouter } from 'next/router'
import { Clock, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export default function AguardandoAprovacaoPage() {
  const router = useRouter()
  const isNovo = router.query.novo === '1'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center">
          <Clock size={28} className="text-[var(--primary)]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--primary)]">Trends</h1>
          <h2 className="text-lg font-semibold">
            {isNovo ? 'Conta criada!' : 'Aguardando aprovação'}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            {isNovo
              ? 'Sua conta foi criada com sucesso via Google. Um administrador precisa aprovar seu acesso antes que você possa usar o sistema.'
              : 'Seu cadastro ainda não foi aprovado pelo administrador. Você receberá acesso assim que for aprovado.'}
          </p>
        </div>

        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 text-left space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">O que acontece agora?</p>
          <ul className="text-sm space-y-1">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--primary)]">1.</span>
              <span>O administrador do sistema receberá uma notificação.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--primary)]">2.</span>
              <span>Assim que aprovado, você poderá entrar normalmente com Google.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--primary)]">3.</span>
              <span>Em caso de dúvidas, contate o administrador da Trends.</span>
            </li>
          </ul>
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut size={16} />
          Voltar para o login
        </Button>
      </div>
    </div>
  )
}
