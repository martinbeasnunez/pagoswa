'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useUser();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError('');

    const result = await login(code);

    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Error al vincular');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-white">PagosWA</h1>
          <p className="text-zinc-400 mt-2">Control de gastos inteligente</p>
        </div>

        {/* Login Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-white">Vincular con Telegram</h2>
              <p className="text-sm text-zinc-400">
                Conecta tu cuenta de Telegram para ver tus gastos
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-4 py-4 border-y border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-xs text-emerald-400 font-bold">1</span>
                </div>
                <div>
                  <p className="text-sm text-white">Abre el bot en Telegram</p>
                  <a
                    href="https://t.me/pagoswa_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline mt-1"
                  >
                    <MessageCircle className="w-3 h-3" />
                    @pagoswa_bot
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-xs text-emerald-400 font-bold">2</span>
                </div>
                <p className="text-sm text-white">Envía el comando <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-emerald-400">/vincular</code></p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-xs text-emerald-400 font-bold">3</span>
                </div>
                <p className="text-sm text-white">Ingresa el código de 6 caracteres aquí</p>
              </div>
            </div>

            {/* Code Input */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-center text-2xl font-mono tracking-widest placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {error && (
                  <p className="text-red-400 text-sm mt-2 text-center">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={code.length !== 6 || isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Vincular cuenta
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-500">
          Tu información se mantiene privada y segura
        </p>
      </div>
    </div>
  );
}
