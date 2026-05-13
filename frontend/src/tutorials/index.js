import { Icon } from '../components/Icon.jsx';
import T1_App from './T1_App.jsx';
import T2_Authorize from './T2_Authorize.jsx';
import T3_Workspace from './T3_Workspace.jsx';
import T4_Whatsapp from './T4_Whatsapp.jsx';
import T5_Curadoria from './T5_Curadoria.jsx';
import T6_Compliance from './T6_Compliance.jsx';

export const TUTORIALS = [
  {
    id: 'app-ml',
    title: 'Criar App no Mercado Livre Developers',
    description: 'Passo a passo pra registrar uma aplicação OAuth e obter Client ID + Secret.',
    duration: '5-10 min',
    difficulty: 'Iniciante',
    icon: Icon.Zap,
    color: 'from-indigo-500 to-fuchsia-500',
    Content: T1_App,
  },
  {
    id: 'autorizar',
    title: 'Autorizar e conectar ao Mercado Livre',
    description: 'Como linkar o app à sua conta de afiliada e habilitar a busca de ofertas.',
    duration: '2 min',
    difficulty: 'Iniciante',
    icon: Icon.Sparkles,
    color: 'from-fuchsia-500 to-pink-500',
    Content: T2_Authorize,
  },
  {
    id: 'workspace',
    title: 'Criar e configurar workspaces',
    description: 'Como organizar nichos, definir filtros e gerenciar diversos contextos.',
    duration: '3 min',
    difficulty: 'Iniciante',
    icon: Icon.ShoppingBag,
    color: 'from-pink-500 to-rose-500',
    Content: T3_Workspace,
  },
  {
    id: 'whatsapp',
    title: 'Conectar WhatsApp e cadastrar grupos',
    description: 'Como vincular um número via QR code e definir grupos de staging por nicho.',
    duration: '5 min',
    difficulty: 'Iniciante',
    icon: Icon.Phone,
    color: 'from-emerald-500 to-teal-500',
    Content: T4_Whatsapp,
  },
  {
    id: 'curadoria',
    title: 'Fluxo de curadoria e aprovação',
    description: 'Como revisar ofertas pendentes, aprovar e enviar para os grupos.',
    duration: '4 min',
    difficulty: 'Iniciante',
    icon: Icon.Check,
    color: 'from-amber-500 to-orange-500',
    Content: T5_Curadoria,
  },
  {
    id: 'compliance',
    title: 'Regras de conformidade legal',
    description: 'Termos do programa ML Afiliados: o que pode, o que não pode, CONAR e LGPD.',
    duration: '5 min',
    difficulty: 'Importante',
    icon: Icon.Activity,
    color: 'from-rose-500 to-red-500',
    Content: T6_Compliance,
  },
];
