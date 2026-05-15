/**
 * Comissões estimadas por categoria de produto no programa de Afiliados ML.
 *
 * Valores são APROXIMADOS (tabela ML varia, mudar conforme atualizações):
 * https://www.mercadolivre.com.br/l/afiliados-comissoes-categorias
 */
export const COMMISSION_BY_CATEGORY = {
  beauty:        0.16, // Beleza
  health:        0.14, // Saúde
  fashion:       0.10, // Moda
  babies:        0.10, // Bebês
  home:          0.10, // Casa & Decoração
  appliances:    0.08, // Eletrodomésticos
  sports:        0.08, // Esportes
  toys:          0.08, // Brinquedos
  pets:          0.08, // Pet shop
  books:         0.08, // Livros
  food:          0.07, // Alimentos
  electronics:   0.06, // Eletrônicos
  computing:     0.05, // Informática
  cellphones:    0.05, // Celulares
  cameras:       0.05, // Câmeras
  auto:          0.05, // Auto-peças
  tools:         0.05, // Ferramentas
  music:         0.05, // Música/Instrumentos
  games:         0.04, // Games (baixa)
  other:         0.05, // Fallback
};

/**
 * Heurísticas de keywords pra detectar a categoria pelo título do produto.
 * Ordem importa — primeira que bater ganha. Por isso categorias bem-pagas
 * vêm primeiro (beauty/health/fashion).
 */
const CATEGORY_KEYWORDS = [
  ['beauty', [
    'maquiagem', 'batom', 'rímel', 'rimel', 'gloss', 'sombra', 'blush', 'corretivo', 'base',
    'perfume', 'colônia', 'colonia', 'fragrância', 'fragrancia', 'eau de',
    'skincare', 'sérum', 'serum', 'hidratante', 'creme facial', 'esfoliante', 'tonico facial',
    'shampoo', 'condicionador', 'máscara capilar', 'mascara capilar', 'cabelo',
    'protetor solar', 'fps', 'esmalte', 'unha', 'manicure',
    'beleza', 'cosmético', 'cosmetico', 'tratamento facial', 'anti-idade', 'anti idade',
    'kit beleza', 'kit cabelo', 'kit maquiagem', 'pincel make', 'paleta',
  ]],
  ['health', [
    'vitamina', 'suplemento', 'whey', 'creatina', 'omega', 'multivitamínico',
    'colágeno', 'colageno', 'melatonina', 'probiotico', 'própolis', 'propolis',
    'farmácia', 'farmacia', 'medicamento', 'analgésico',
  ]],
  ['fashion', [
    'vestido', 'blusa', 'camisa', 'calça', 'calca', 'short', 'bermuda',
    'tênis', 'tenis', 'sapato', 'sandália', 'sandalia', 'chinelo', 'sapatilha',
    'bolsa', 'mochila', 'carteira',
    'jeans', 'moletom', 'jaqueta', 'casaco', 'sobretudo',
    'biquíni', 'biquini', 'maiô', 'maio', 'regata', 'cropped',
    'lingerie', 'sutiã', 'sutia', 'calcinha', 'pijama',
    'tamanho', ' pp ', ' p ', ' m ', ' g ', ' gg ',
  ]],
  ['babies', [
    'bebê', 'bebe ', 'infantil', 'fralda', 'mamadeira', 'chupeta',
    'carrinho de bebê', 'berço', 'berco', 'banheira',
    'macacão', 'macacao', 'body bebê', 'sapatinho',
  ]],
  ['home', [
    'jogo de cama', 'lençol', 'lencol', 'toalha', 'cortina', 'tapete', 'almofada',
    'panela', 'frigideira', 'jogo de panela', 'utilidades dom',
    'organizador', 'cesto', 'caixa organizadora',
    'cozinha', 'mesa posta',
  ]],
  ['appliances', [
    'geladeira', 'fogão', 'fogao', 'forno', 'micro-ondas', 'microondas',
    'máquina de lavar', 'lava roupas', 'secadora', 'lava louças', 'lava loucas',
    'air fryer', 'fritadeira', 'liquidificador', 'batedeira', 'processador',
    'aspirador', 'aspirador de pó', 'ventilador', 'climatizador',
    'cafeteira', 'cafeteira expresso', 'sanduicheira',
  ]],
  ['sports', [
    'bicicleta', 'bike', 'esteira', 'halteres', 'pesos', 'caneleira',
    'futebol', 'chuteira', 'bola', 'fitness', 'academia',
    'tênis de corrida', 'tenis de corrida', 'roupa fitness',
  ]],
  ['toys', [
    'brinquedo', 'boneca', 'lego', 'pelúcia', 'pelucia', 'quebra-cabeça',
    'jogos de tabuleiro', 'pista de carrinho', 'carrinho de brinquedo',
  ]],
  ['pets', [
    'ração', 'racao', 'pet', 'cachorro', 'gato', 'coleira', 'arranhador',
    'guia para cachorro', 'casinha pet', 'aquário', 'aquario',
  ]],
  ['books', [
    'livro', 'kindle', 'mangá', 'manga', 'hq', 'gibi', 'romance',
    'autoajuda', 'biografia', 'literatura',
  ]],
  ['food', [
    'café', ' cafe ', 'chocolate', 'biscoito', 'snack',
    'azeite', 'óleo', 'oleo de', 'tempero', 'açúcar', 'acucar',
    'kit gourmet', 'cesta básica', 'cesta basica',
  ]],
  ['games', [
    'playstation', 'ps4', 'ps5', 'xbox', 'nintendo', 'switch',
    'jogo', 'game', 'console',
  ]],
  ['cellphones', [
    'celular', 'smartphone', 'iphone', 'galaxy', 'redmi', 'xiaomi',
    'capa de celular', 'película', 'pelicula', 'carregador celular',
  ]],
  ['electronics', [
    'fone', 'headphone', 'earbud', 'jbl', 'bluetooth speaker',
    'caixa de som', 'smart tv', ' tv ', 'soundbar',
    'smartwatch', 'apple watch', 'mi band', 'amazfit',
    'câmera', 'camera', 'drone', 'gopro',
  ]],
  ['computing', [
    'notebook', 'laptop', 'desktop', 'pc gamer', 'monitor',
    'mouse', 'teclado', 'webcam', 'ssd', 'hd externo', 'memória ram', 'memoria ram',
    'placa de vídeo', 'placa de video', 'processador',
    'roteador', 'wifi',
  ]],
  ['auto', [
    'pneu', 'roda', 'óleo de motor', 'oleo de motor', 'bateria automotiva',
    'limpa para-brisa', 'capa automotiva', 'tapete automotivo',
  ]],
  ['tools', [
    'furadeira', 'parafusadeira', 'serra', 'martelo', 'chave',
    'ferramenta', 'kit ferramentas',
  ]],
];

/**
 * Detecta a categoria do produto pelo título (case-insensitive).
 * Retorna 'other' se nenhuma keyword bater.
 */
export function detectCategory(title) {
  if (!title) return 'other';
  const t = title.toLowerCase();
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (t.includes(kw)) return cat;
    }
  }
  return 'other';
}

export function commissionPctFor(category) {
  return COMMISSION_BY_CATEGORY[category] ?? COMMISSION_BY_CATEGORY.other;
}

export function estimateCommission(price, category) {
  return price * commissionPctFor(category);
}

/**
 * Tradução amigável (UI).
 */
export const CATEGORY_LABELS = {
  beauty:      '💄 Beleza',
  health:      '💊 Saúde',
  fashion:     '👗 Moda',
  babies:      '👶 Bebês',
  home:        '🏠 Casa',
  appliances:  '🔌 Eletrodom.',
  sports:      '⚽ Esportes',
  toys:        '🧸 Brinquedos',
  pets:        '🐶 Pet',
  books:       '📚 Livros',
  food:        '🍔 Alimentos',
  electronics: '🎧 Eletrônicos',
  computing:   '💻 Informática',
  cellphones:  '📱 Celulares',
  cameras:     '📷 Câmeras',
  auto:        '🚗 Auto',
  tools:       '🛠️ Ferramentas',
  music:       '🎸 Música',
  games:       '🎮 Games',
  other:       '📦 Outros',
};
