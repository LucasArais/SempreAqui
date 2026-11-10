const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(name, mocks, globals = {}) {
  const file = path.resolve(__dirname, '../src/lib', `${name}.ts`);
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, AbortController, ...globals, require: (id) => {
    if (!(id in mocks)) throw new Error(`Import inesperado: ${id}`);
    return mocks[id];
  } });
  return module.exports;
}
function pendente() {
  let resolve;
  const promessa = new Promise((r) => { resolve = r; });
  return { promessa, resolve };
}
function ambiente(trabalhos = {}) {
  const chamadas = [];
  const sessao = { usuario: 'conta-a', pronta: true };
  let trocar;
  const tarefa = (nome) => async () => {
    chamadas.push(nome);
    return trabalhos[nome] ? trabalhos[nome]() : true;
  };
  const lib = load('carregamento', {
    react: { useSyncExternalStore: (_subscribe, get) => get() },
    './sessao': { sessaoAtual: () => sessao, aoTrocarConta: (fn) => { trocar = fn; } },
    './conversa': { carregarConversa: tarefa('conversa') },
    './diario': { iniciarDiario: tarefa('diario') },
    './familia': { carregarFamilia: tarefa('familia') },
    './passaporte': { carregarPassaporte: tarefa('passaporte') },
    './semana': { atualizarSemana: tarefa('semana') },
  });
  return { lib, chamadas, sessao, trocar: () => trocar() };
}

test('começa todos os dados em paralelo, sem depender de IA local', async () => {
  const lento = pendente();
  const a = ambiente({ conversa: () => lento.promessa });
  const trabalho = a.lib.atualizarDados();
  assert.deepEqual(a.chamadas, ['passaporte', 'familia', 'diario', 'conversa', 'semana']);
  assert.equal(a.lib.useCarregamento().carregando, true);
  lento.resolve(true);
  await trabalho;
  assert.equal(a.lib.useCarregamento().carregando, false);
  assert.equal(a.lib.useCarregamento().erro, null);
});

test('foco e abertura simultâneos compartilham uma única atualização', async () => {
  const lento = pendente();
  const a = ambiente({ familia: () => lento.promessa });
  const primeira = a.lib.atualizarDados();
  assert.equal(a.lib.atualizarDados(), primeira);
  assert.equal(a.chamadas.length, 5);
  lento.resolve(true);
  await primeira;
});

test('falha parcial encerra o loader, mostra erro e permite nova tentativa', async () => {
  let falhar = true;
  const a = ambiente({ familia: async () => !falhar });
  await a.lib.atualizarDados();
  assert.equal(a.lib.useCarregamento().carregando, false);
  assert.match(a.lib.useCarregamento().erro, /tente de novo/);
  falhar = false;
  await a.lib.atualizarDados();
  assert.equal(a.lib.useCarregamento().erro, null);
  assert.equal(a.lib.useCarregamento().carregado, true);
  assert.equal(a.chamadas.length, 10);
});

test('exceção em uma seção não impede carregar as demais', async () => {
  const a = ambiente({ diario: async () => { throw new Error('servidor indisponível'); } });
  await a.lib.atualizarDados();
  assert.equal(a.chamadas.length, 5);
  assert.ok(a.lib.useCarregamento().erro);
  assert.equal(a.lib.useCarregamento().carregando, false);
});

test('logout ignora a conclusão da conta anterior e não bloqueia a próxima', async () => {
  const lento = pendente();
  const a = ambiente({ familia: () => lento.promessa });
  const antiga = a.lib.atualizarDados();
  a.sessao.usuario = null;
  a.sessao.pronta = false;
  a.trocar();
  lento.resolve(false);
  await antiga;
  assert.equal(a.lib.useCarregamento().erro, null);
  assert.equal(a.lib.useCarregamento().carregado, false);
  await a.lib.atualizarDados();
  assert.equal(a.chamadas.length, 5);
});

test('requisição sem resposta é abortada, permitindo sair do carregamento', async () => {
  let abortou = false;
  const { requisicao } = load('requisicao', {}, { fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { abortou = true; reject(new Error('abortado')); });
  }) });
  await assert.rejects(requisicao('https://exemplo.test', {}, 5), /abortado/);
  assert.equal(abortou, true);
});

test('limite cobre também corpo da resposta que fica pendente', async () => {
  const { requisicao } = load('requisicao', {}, { fetch: async (_url, { signal }) => ({
    status: 200, json: () => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abortado')));
    }),
  }) });
  await assert.rejects(requisicao('https://exemplo.test', {}, 5), /demorou demais/);
});

test('família notifica a tela sobre a cópia local antes da resposta da rede', async () => {
  const rede = pendente();
  let notificacoes = 0;
  const copia = { membros: [{ nome: 'Cláudia' }], eu: { nome: 'Cláudia' }, tarefas: [], feed: [], carregado: true };
  const lib = load('familia', {
    './armazenamento-conta': { default: { getItem: async () => JSON.stringify(copia), setItem: async () => {} }, __esModule: true },
    'expo-notifications': {},
    react: { useSyncExternalStore: (subscribe, get) => { subscribe(() => { notificacoes++; }); return get(); } },
    './sessao': { sessaoAtual: () => ({ pronta: true, usuario: 'a' }), aoTrocarConta() {} },
    './api': { api: { familia: () => rede.promessa, tarefas: async () => [], feed: async () => [] } },
  });
  lib.useFamilia();
  const carregamento = lib.carregarFamilia();
  await new Promise(setImmediate);
  assert.equal(lib.familiaAtual().eu.nome, 'Cláudia');
  assert.equal(lib.familiaAtual().carregado, false);
  assert.equal(notificacoes, 1);
  rede.resolve({ membros: [], eu: { nome: 'Cláudia' } });
  assert.equal(await carregamento, true);
});
