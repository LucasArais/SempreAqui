/** Limita a espera inclusive pela leitura do corpo; o abort encerra a conexão pendente. */
export async function requisicao(url: string, init: RequestInit = {}, prazoMs = 20_000) {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), prazoMs);
  try {
    const resposta = await fetch(url, { ...init, signal: controller.signal });
    const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => null);
    if (controller.signal.aborted) throw new Error('A conexão demorou demais.');
    return { resposta, corpo };
  } finally {
    clearTimeout(limite);
  }
}
