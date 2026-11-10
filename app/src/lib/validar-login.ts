export function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validarEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(email))
    ? null
    : 'Esse e-mail não parece certo. Confira se faltou alguma letra.';
}

export function mensagemLogin(erro: { code?: string; status?: number; name?: string }) {
  if (erro.name === 'AuthRetryableFetchError' || erro.name === 'TypeError') {
    return 'Parece que você está sem internet. Tente de novo quando a conexão voltar.';
  }
  if (erro.status === 429) return 'Muitas tentativas agora. Espere um pouco e tente de novo.';
  if (erro.code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar. Confira sua caixa de entrada.';
  if (erro.code === 'invalid_credentials') return 'E-mail ou senha não conferem.';
  return 'Não consegui entrar agora. Tente de novo em instantes.';
}
