import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Calendar,
  ChevronRight,
  Circle,
  CircleCheck,
  ClipboardList,
  Clock,
  FileText,
  Hand,
  Heart,
  House,
  Image as ImageIcon,
  Leaf,
  LifeBuoy,
  Link,
  Lock,
  type LucideIcon,
  MessageSquare,
  Mic,
  Moon,
  Music,
  Pill,
  Phone,
  Play,
  Plus,
  Share,
  Smile,
  Square,
  Sun,
  TriangleAlert,
  Users,
  Utensils,
  X,
} from 'lucide-react-native';
import { Platform } from 'react-native';

import { tamanho } from '@/theme';

type SF = SymbolViewProps['name'];

/**
 * Ícones do app. iOS usa SF Symbols. Android e web usam Lucide, de traço equivalente.
 * Em ações importantes, o ícone sempre vem acompanhado de texto.
 */
const icones = {
  gravar: { sf: 'mic.fill', lucide: Mic },
  parar: { sf: 'stop.fill', lucide: Square },
  onda: { sf: 'waveform', lucide: AudioLines },
  chevron: { sf: 'chevron.right', lucide: ChevronRight },
  calendario: { sf: 'calendar', lucide: Calendar },
  familia: { sf: 'person.2', lucide: Users },
  coracao: { sf: 'heart', lucide: Heart },
  livro: { sf: 'book.closed', lucide: BookOpen },
  ajuda: { sf: 'lifepreserver', lucide: LifeBuoy },
  telefone: { sf: 'phone.fill', lucide: Phone },
  musica: { sf: 'music.note', lucide: Music },
  foto: { sf: 'photo', lucide: ImageIcon },
  compartilhar: { sf: 'square.and.arrow.up', lucide: Share },
  feito: { sf: 'checkmark.circle.fill', lucide: CircleCheck },
  pendente: { sf: 'circle', lucide: Circle },
  sono: { sf: 'moon', lucide: Moon },
  comida: { sf: 'fork.knife', lucide: Utensils },
  humor: { sf: 'face.smiling', lucide: Smile },
  remedio: { sf: 'pills', lucide: Pill },
  calma: { sf: 'leaf', lucide: Leaf },
  atencao: { sf: 'exclamationmark.triangle', lucide: TriangleAlert },
  relogio: { sf: 'clock', lucide: Clock },
  texto: { sf: 'text.bubble', lucide: MessageSquare },
  tocar: { sf: 'play.fill', lucide: Play },
  fechar: { sf: 'xmark', lucide: X },
  link: { sf: 'link', lucide: Link },
  cadeado: { sf: 'lock', lucide: Lock },
  documento: { sf: 'doc.text', lucide: FileText },
  adicionar: { sf: 'plus', lucide: Plus },
  casa: { sf: 'house', lucide: House },
  seguir: { sf: 'arrow.right', lucide: ArrowRight },
  consulta: { sf: 'list.bullet.clipboard', lucide: ClipboardList },
  sol: { sf: 'sun.max', lucide: Sun },
  mao: { sf: 'hand.raised', lucide: Hand },
} satisfies Record<string, { sf: SF; lucide: LucideIcon }>;

export type NomeIcone = keyof typeof icones;

export function Icon({
  nome,
  cor,
  tamanho: tam = tamanho.icone,
}: {
  nome: NomeIcone;
  cor: string;
  tamanho?: number;
}) {
  const icone = icones[nome];
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={icone.sf}
        tintColor={cor}
        size={tam}
        weight="regular"
        style={{ width: tam, height: tam }}
        accessible={false}
      />
    );
  }
  const Lucide = icone.lucide;
  return <Lucide color={cor} size={tam} strokeWidth={1.75} accessible={false} />;
}
