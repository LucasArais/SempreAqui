/**
 * llama.rn e whisper.rn são a IA no aparelho do Android. No iPhone, a IA local usa o modelo e o
 * reconhecimento de fala da Apple (modules/ia-local), então esses pacotes ficam fora do build do iOS.
 */
module.exports = {
  dependencies: {
    'llama.rn': { platforms: { ios: null } },
    'whisper.rn': { platforms: { ios: null } },
  },
};
