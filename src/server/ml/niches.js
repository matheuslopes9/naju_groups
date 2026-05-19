/**
 * Catálogo de nichos pré-cadastrados.
 * Cada nicho tem keywords prontas, público-alvo e categoria detectada.
 *
 * Quando o usuário escolhe um nicho no workspace, o sistema preenche
 * automaticamente as keywords (mas permite edição posterior).
 */

export const NICHE_PRESETS = [
  // ====== BELEZA ======
  {
    id: 'beauty-f',
    label: '💄 Beleza Feminina',
    audience: 'female',
    category: 'beauty',
    keywords: 'maquiagem, batom, base, gloss, eyeliner, rímel, sombra, blush, corretivo, paleta, primer, contorno, iluminador, sérum facial, hidratante facial, máscara facial, esfoliante, tônico, anti-idade, protetor solar, vitamina c, ácido hialurônico, perfume feminino, eau de parfum, body splash, óleo essencial, esmalte, base para unha, shampoo, condicionador, máscara capilar, leave-in, óleo capilar, escova progressiva, alisador, cílios postiços, sobrancelha, pomada modeladora',
  },
  {
    id: 'beauty-m',
    label: '🧔 Beleza Masculina',
    audience: 'male',
    category: 'beauty',
    keywords: 'perfume masculino, eau de toilette, eau de parfum, colônia masculina, body splash masculino, deodorante, antitranspirante, after shave, pomada modeladora, gel cabelo, cera barba, óleo barba, balm barba, shampoo masculino, hidratante facial masculino, sérum masculino, kit barba, aparador barba, navalha, lâmina barba, sabonete facial',
  },

  // ====== MODA ======
  {
    id: 'fashion-f',
    label: '👗 Moda Feminina',
    audience: 'female',
    category: 'fashion',
    keywords: 'vestido, blusa, saia, calça feminina, jeans feminino, short feminino, biquíni, maiô, lingerie, sutiã, calcinha, pijama feminino, camisola, regata, cropped, blusinha, bolsa feminina, mochila feminina, carteira feminina, sandália, salto, scarpin, sapatilha, rasteirinha, tênis feminino, bota feminina, óculos sol feminino',
  },
  {
    id: 'fashion-m',
    label: '👔 Moda Masculina',
    audience: 'male',
    category: 'fashion',
    keywords: 'camisa masculina, camiseta masculina, polo, regata masculina, calça masculina, jeans masculino, bermuda masculina, short masculino, moletom masculino, jaqueta masculina, casaco masculino, blazer, terno, gravata, cinto masculino, cueca, pijama masculino, tênis masculino, sapato masculino, sapatênis, mocassim, chinelo masculino, bota masculina, óculos sol masculino, relógio masculino, carteira masculina, mochila masculina',
  },

  // ====== TECH ======
  {
    id: 'tech',
    label: '💻 Tech / Gadgets',
    audience: 'unisex',
    category: 'electronics',
    keywords: 'fone bluetooth, headphone, earbud, jbl, soundbar, caixa de som, smartwatch, apple watch, mi band, amazfit, smart tv, smart band, drone, gopro, câmera, notebook, mouse gamer, teclado mecânico, monitor, ssd, hd externo, pendrive, roteador, wifi mesh, carregador, power bank, cabo usb-c, suporte celular, película, capa de celular',
  },
  {
    id: 'cellphones',
    label: '📱 Celulares & Acessórios',
    audience: 'unisex',
    category: 'cellphones',
    keywords: 'iphone, galaxy, redmi, xiaomi, motorola, smartphone, celular, capa celular, capinha, película, suporte, carregador, cabo, fone iphone, fone bluetooth, power bank, smartwatch',
  },
  {
    id: 'computing',
    label: '🖥️ Informática',
    audience: 'unisex',
    category: 'computing',
    keywords: 'notebook, ultrabook, dell, lenovo, acer, asus, mouse, teclado, monitor, webcam, headset, ssd, memória ram, hd externo, pen drive, cooler, gabinete, fonte, placa de vídeo, processador, mousepad, suporte notebook',
  },

  // ====== CASA ======
  {
    id: 'home',
    label: '🏠 Casa & Decoração',
    audience: 'unisex',
    category: 'home',
    keywords: 'jogo de cama, lençol, edredom, fronha, toalha, cortina, tapete, almofada, manta, painel parede, quadro, vaso, luminária, abajur, organizador, cesto, caixa organizadora, mesa lateral, prateleira, espelho, cabide, varal, ferro de passar',
  },
  {
    id: 'kitchen',
    label: '🍳 Cozinha',
    audience: 'unisex',
    category: 'home',
    keywords: 'panela, frigideira, jogo de panelas, panela de pressão, panela elétrica, air fryer, fritadeira, liquidificador, batedeira, processador, mixer, cafeteira, sanduicheira, grill, micro-ondas, faqueiro, faca, jogo americano, prato, copo, xícara, taça, garrafa térmica',
  },

  // ====== ELETRODOMÉSTICOS ======
  {
    id: 'appliances',
    label: '🔌 Eletrodomésticos',
    audience: 'unisex',
    category: 'appliances',
    keywords: 'geladeira, fogão, forno, micro-ondas, lava louças, máquina de lavar, lavadora, secadora, lava e seca, ar condicionado, aspirador de pó, robô aspirador, ventilador, climatizador, purificador de ar, umidificador, ferro de passar',
  },

  // ====== FITNESS ======
  {
    id: 'fitness-f',
    label: '🏋️‍♀️ Fitness Feminino',
    audience: 'female',
    category: 'sports',
    keywords: 'top fitness, legging, short fitness, calça fitness, conjunto fitness, regata fitness, tênis academia, halteres, caneleira, faixa elástica, bola pilates, colchonete yoga, garrafa squeeze, coqueteleira, mochila academia, fita kt, esteira, bicicleta ergométrica',
  },
  {
    id: 'fitness-m',
    label: '💪 Fitness Masculino',
    audience: 'male',
    category: 'sports',
    keywords: 'camiseta dry fit, regata academia, short academia, bermuda academia, calça moletom, tênis musculação, tênis corrida, halteres, anilha, barra, kettlebell, faixa elástica, luva academia, cinta lombar, mochila academia, whey, creatina, suplemento, esteira, bicicleta ergométrica',
  },

  // ====== SAÚDE / SUPLEMENTOS ======
  {
    id: 'supplements',
    label: '💊 Suplementos',
    audience: 'unisex',
    category: 'health',
    keywords: 'whey protein, whey isolado, creatina, bcaa, glutamina, ômega 3, vitamina c, vitamina d, multivitamínico, colágeno, melatonina, magnésio, zinco, probiótico, pré treino, hipercalórico, termogênico, cafeína, taurina',
  },

  // ====== BEBÊS ======
  {
    id: 'babies',
    label: '👶 Bebês',
    audience: 'unisex',
    category: 'babies',
    keywords: 'fralda, mamadeira, chupeta, bico, body bebê, macacão bebê, sapatinho, carrinho de bebê, bebê conforto, cadeirinha auto, berço, banheira bebê, naninha, manta bebê, fralda de pano, mamilo de silicone, esterilizador',
  },

  // ====== PET ======
  {
    id: 'pets',
    label: '🐶 Pet Shop',
    audience: 'unisex',
    category: 'pets',
    keywords: 'ração, ração cachorro, ração gato, petisco, sachê pet, comedouro, bebedouro, cama pet, coleira, guia, peitoral, areia gato, caixa transporte, brinquedo pet, escova pet, shampoo pet, antipulgas, vermífugo',
  },

  // ====== UTILIDADES MIX ======
  {
    id: 'general',
    label: '📦 Ofertas Gerais',
    audience: 'unisex',
    category: 'other',
    keywords: '', // vazio = sem filtro de keyword (aceita tudo)
  },
];

export function findNiche(id) {
  return NICHE_PRESETS.find((n) => n.id === id) ?? null;
}
