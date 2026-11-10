/**
 * Fora do Android, não há adaptador: o iPhone usa o módulo nativo da Apple e o resto usa a nuvem.
 * O Metro escolhe adaptador.android.ts no Android, então o iOS nunca empacota o llama.rn nem o
 * whisper.rn.
 */
import type { IaLocalNativo, ModelosAndroid } from './tipos';

const adaptador: { ia: IaLocalNativo | null; modelos: ModelosAndroid | null } = { ia: null, modelos: null };
export default adaptador;
