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


export const VERSAO_TERMOS = '1';
export function requisitosSenha(senha: string) {
  return { tamanho: senha.length >= 8, letra: /\p{L}/u.test(senha), numero: /[0-9]/.test(senha) };
}
export function validarCadastro(nome: string, email: string, senha: string, aceito: boolean) {
  const regras = requisitosSenha(senha);
  return {
    nome: nome.trim().length < 2 || nome.trim().length > 60 ? 'Diga seu nome, com 2 a 60 caracteres.' : null,
    email: email.trim().length > 254 ? 'Confira o tamanho do e-mail informado.' : validarEmail(email),
    senha: senha.length > 128 ? 'Use até 128 caracteres na senha.' : !Object.values(regras).every(Boolean) ? 'Use pelo menos 8 caracteres, uma letra e um número.' : null,
    aceite: aceito ? null : 'Marque o aceite para criar sua conta.',
  };
}
