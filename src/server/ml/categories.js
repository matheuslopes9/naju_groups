/**
 * Lista das categorias top-level do Mercado Livre Brasil (MLB).
 * IDs estáveis; em vez de chamar /sites/MLB/categories toda vez (requer
 * Bearer + tem rate limit), mantém hardcoded.
 *
 * Fonte: https://api.mercadolibre.com/sites/MLB/categories (consultado 2026-05)
 */
export const MLB_CATEGORIES = [
  { id: 'MLB1246',  name: 'Beleza e Cuidado Pessoal',  emoji: '💄' },
  { id: 'MLB1430',  name: 'Calçados, Roupas e Bolsas', emoji: '👗' },
  { id: 'MLB1574',  name: 'Casa, Móveis e Decoração',  emoji: '🏠' },
  { id: 'MLB1000',  name: 'Eletrônicos, Áudio e Vídeo', emoji: '🎧' },
  { id: 'MLB1051',  name: 'Celulares e Telefones',     emoji: '📱' },
  { id: 'MLB1648',  name: 'Informática',               emoji: '💻' },
  { id: 'MLB5726',  name: 'Eletrodomésticos',          emoji: '🔌' },
  { id: 'MLB1132',  name: 'Brinquedos e Hobbies',      emoji: '🧸' },
  { id: 'MLB1384',  name: 'Bebês',                     emoji: '👶' },
  { id: 'MLB264586', name: 'Saúde',                    emoji: '💊' },
  { id: 'MLB1276',  name: 'Esportes e Fitness',        emoji: '⚽' },
  { id: 'MLB1144',  name: 'Games',                     emoji: '🎮' },
  { id: 'MLB1039',  name: 'Câmeras e Acessórios',      emoji: '📷' },
  { id: 'MLB3937',  name: 'Joias e Relógios',          emoji: '💍' },
  { id: 'MLB1196',  name: 'Livros, Revistas e Comics', emoji: '📚' },
  { id: 'MLB1182',  name: 'Instrumentos Musicais',     emoji: '🎸' },
  { id: 'MLB1071',  name: 'Animais',                   emoji: '🐶' },
  { id: 'MLB1403',  name: 'Alimentos e Bebidas',       emoji: '🍔' },
  { id: 'MLB263532', name: 'Ferramentas',              emoji: '🛠️' },
  { id: 'MLB1500',  name: 'Construção',                emoji: '🔨' },
  { id: 'MLB5672',  name: 'Acessórios para Veículos',  emoji: '🚗' },
  { id: 'MLB1743',  name: 'Carros, Motos e Outros',    emoji: '🚙' },
  { id: 'MLB1368',  name: 'Arte, Papelaria e Armarinho', emoji: '🎨' },
  { id: 'MLB1168',  name: 'Música, Filmes e Seriados', emoji: '🎬' },
  { id: 'MLB12404', name: 'Festas e Lembrancinhas',    emoji: '🎉' },
  { id: 'MLB271599', name: 'Agro',                     emoji: '🌾' },
  { id: 'MLB1499',  name: 'Indústria e Comércio',      emoji: '🏭' },
  { id: 'MLB1459',  name: 'Imóveis',                   emoji: '🏘️' },
  { id: 'MLB1540',  name: 'Serviços',                  emoji: '🧰' },
  { id: 'MLB1367',  name: 'Antiguidades e Coleções',   emoji: '🏛️' },
  { id: 'MLB1953',  name: 'Mais Categorias',           emoji: '📦' },
];

export function findCategory(id) {
  return MLB_CATEGORIES.find((c) => c.id === id);
}
