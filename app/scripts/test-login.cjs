const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function ambiente({ session = null, loginError = null, logoutError = null } = {}) {
  const modules = new Map();
  const secure = new Map();
  const cache = new Map();
  let callback;
  let options;
  let credentials;
  let anonymousCalls = 0;
  let backendCalls = 0;
  const auth = {
    onAuthStateChange: (cb) => { callback = cb; },
    getSession: async () => ({ data: { session }, error: null }),
    signInAnonymously: () => { anonymousCalls++; throw new Error('Login anônimo proibido'); },
    signInWithPassword: async (input) => {
      credentials = input;
      if (loginError) return { error: loginError };
      const data = { session: { access_token: 'access-ficticio' }, user: { id: 'conta-a' } };
      await options.auth.storage.setItem(options.auth.storageKey, 'sessao-ficticia');
      callback('SIGNED_IN', { ...data.session, user: data.user });
      return { data, error: null };
    },
    signOut: async () => {
      if (logoutError) return { error: logoutError };
      await options.auth.storage.removeItem(options.auth.storageKey);
      callback('SIGNED_OUT', null);
      return { error: null };
    },
  };
  function load(name) {
    const file = path.resolve(__dirname, '../src/lib', `${name}.ts`);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, {
      exports: module.exports, module, URL, process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://example.test', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publica-ficticia' } },
      require: (id) => {
        if (id === '@react-native-async-storage/async-storage') return { getItem: async (k) => cache.get(k) ?? null, setItem: async (k, v) => { cache.set(k, v); }, removeItem: async (k) => { cache.delete(k); }, multiRemove: async (keys) => { keys.forEach((k) => cache.delete(k)); } };
        if (id === 'react-native-url-polyfill/auto') return {};
        if (id === '@supabase/supabase-js') return { createClient: (_url, _key, config) => { options = config; return { auth }; } };
        if (id === 'expo-secure-store') return { getItemAsync: async (k) => secure.get(k) ?? null, setItemAsync: async (k, v) => { secure.set(k, v); }, deleteItemAsync: async (k) => { secure.delete(k); } };
        if (id === 'react-native') return { Platform: { OS: 'ios' }, AppState: { addEventListener() {} } };
        if (id === 'react') return { useSyncExternalStore() {} };
        if (id === './api') return { api: { sessao: async () => { backendCalls++; return { familia: 'familia-a', papel: 'quem_cuida' }; } } };
        return load(id.replace('./', ''));
      },
    }, { filename: file });
    return module.exports;
  }
  return { load, secure, auth, get credentials() { return credentials; }, get anonymousCalls() { return anonymousCalls; }, get backendCalls() { return backendCalls; } };
}

test('sem sessão, não cria usuário anônimo nem abre a família', async () => {
  const a = ambiente();
  await a.load('entrar').entrar();
  assert.equal(a.load('sessao').sessaoAtual().pronta, false);
  assert.equal(a.load('sessao').sessaoAtual().restaurada, true);
  assert.equal(a.anonymousCalls, 0);
  assert.equal(a.backendCalls, 0);
});

test('restaura conta existente e abre a família', async () => {
  const a = ambiente({ session: { access_token: 'access-ficticio', user: { id: 'conta-a', is_anonymous: false } } });
  await a.load('entrar').entrar();
  assert.equal(a.load('sessao').sessaoAtual().pronta, true);
  assert.equal(a.backendCalls, 1);
});

test('sessão anônima antiga não libera acesso', async () => {
  const a = ambiente({ session: { access_token: 'anonimo', user: { id: 'anonimo', is_anonymous: true } } });
  await a.load('entrar').entrar();
  assert.equal(a.load('sessao').sessaoAtual().pronta, false);
  assert.equal(a.backendCalls, 0);
});

test('normaliza e-mail, preserva senha e usa armazenamento seguro; logout limpa sessão', async () => {
  const a = ambiente();
  const s = a.load('sessao');
  await s.entrarComSenha('  CLAUDIA@Example.COM ', ' senha com espaços ');
  assert.equal(a.credentials.email, 'claudia@example.com');
  assert.equal(a.credentials.password, ' senha com espaços ');
  assert.equal(a.secure.size, 1);
  s.definirFamilia('familia-a', 'quem_cuida');
  await s.sair();
  assert.equal(a.secure.size, 0);
  assert.equal(s.sessaoAtual().token, null);
  assert.equal(s.sessaoAtual().familia, null);
  assert.equal(s.sessaoAtual().pronta, false);
});

test('credenciais incorretas não liberam sessão e mostram mensagem única', async () => {
  const a = ambiente({ loginError: { code: 'invalid_credentials' } });
  const s = a.load('sessao');
  await assert.rejects(s.entrarComSenha('a@example.com', 'errada'), /E-mail ou senha não conferem/);
  assert.equal(s.sessaoAtual().token, null);
  assert.equal(s.sessaoAtual().pronta, false);
});

test('falha de logout não simula saída nem apaga a sessão local', async () => {
  const a = ambiente({ logoutError: { status: 500 } });
  const s = a.load('sessao');
  await s.entrarComSenha('a@example.com', 'senha');
  s.definirFamilia('familia-a', 'quem_cuida');
  await assert.rejects(s.sair(), /Não consegui sair/);
  assert.equal(s.sessaoAtual().pronta, true);
  assert.equal(a.secure.size, 1);
});

test('validação aceita e-mail normalizado e rejeita formatos inválidos', () => {
  const v = ambiente().load('validar-login');
  assert.equal(v.validarEmail('  EU@EXAMPLE.COM  '), null);
  for (const email of ['', 'eu', 'eu@', '@exemplo.com', 'a b@exemplo.com']) assert.ok(v.validarEmail(email));
  assert.match(v.mensagemLogin({ name: 'AuthRetryableFetchError' }), /sem internet/);
});


test('cópias offline são isoladas por conta e preservadas depois de sair', async () => {
  const a = ambiente();
  const s = a.load('sessao');
  const storage = a.load('armazenamento-conta').default;
  await assert.rejects(storage.getItem('familia.v1'), /Entre para acessar/);
  await s.entrarComSenha('a@example.com', 'senha');
  await storage.setItem('familia.v1', 'dados da conta A');
  await s.sair();
  a.auth.getSession = async () => ({ data: { session: { access_token: 'token-b', user: { id: 'conta-b', is_anonymous: false } } }, error: null });
  await s.garantirLogin();
  assert.equal(await storage.getItem('familia.v1'), null);
  await storage.setItem('familia.v1', 'dados da conta B');
  await s.sair();
  await s.entrarComSenha('a@example.com', 'senha');
  assert.equal(await storage.getItem('familia.v1'), 'dados da conta A');
});


test('cadastro exige nome, e-mail válido, senha com requisitos e aceite', () => {
  const v = ambiente().load('validar-login');
  const correto = v.validarCadastro('Cláudia', 'claudia@example.com', 'Senha123', true);
  assert.equal(Object.values(correto).every((e) => e === null), true);
  for (const [campo, valores] of [
    ['nome', [' ', 'a']], ['email', ['errado', '@exemplo.com']], ['senha', ['curta1', 'soletRas', '123456789']],
  ]) for (const valor of valores) {
    const d = { nome: 'Cláudia', email: 'c@example.com', senha: 'Senha123', aceite: true, [campo]: valor };
    assert.ok(v.validarCadastro(d.nome, d.email, d.senha, d.aceite)[campo]);
  }
  assert.ok(v.validarCadastro('Cláudia', 'c@example.com', 'Senha123', false).aceite);
});
