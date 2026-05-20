/**
 * Biblioteca de copy (frases) por nicho + sub-nicho + gatilhos especiais.
 *
 * Estrutura de prioridade na escolha de frases:
 *   1. Gatilhos especiais (cupom, desconto>=50%, mais-vendido) — quando aplicável
 *   2. Sub-nicho detectado pelo título (ex: cabelo dentro de beauty-f)
 *   3. Nicho geral do workspace
 *   4. Fallback unisex
 *
 * Cada bucket tem: hooks, priceOpeners, priceNow, closers, ctas.
 * Pesos seeded por productId → mesma oferta produz texto idempotente.
 */

// ============================================================================
// HOOKS POR NICHO (30+ cada)
// ============================================================================

const HOOKS = {
  // ── BELEZA FEMININA ────────────────────────────────────────────────────────
  'beauty-f': [
    'MAIS UM 💅', 'OLHA QUE LUXO 💖', 'AMORES, CORREEEE 🏃‍♀️',
    'TÔ DOIDA POR ISSO 😍', 'NÃO DEIXA ESCAPAR 💸', 'PRA VOCÊ SE AMAR MAIS 💕',
    'GASTE COM VOCÊ 💝', 'INVISTA EM VOCÊ ✨', 'PROMOÇÃO IRRESISTÍVEL 🔥',
    'TÔ APAIXONADA 😻', 'AMEEEI 💗', 'PRECIOSIDADE 💎',
    'ELA SE SALVOU 🙌', 'MEU DEUS QUE PREÇO 😱', 'NÃO É DE GRAÇA MAS QUASE 💸',
    'PRA SE SENTIR DEUSA 👑', 'AUTOCUIDADO É TUDO 🛁', 'GLOW UP NA ÁREA ✨',
    'MULHERADA, AGENDA AÍ 📝', 'CHEGOU O DIA 🎉', 'BEM-ESTAR EM PROMO 🌸',
    'GLOSS UP, MEU AMOR 💋', 'BOMBA DA SEMANA 💣', 'PRIORIDADE NA SUA LISTA 🎀',
    'DOSE DE AMOR PRÓPRIO 💞', 'GOSTOSURA EM OFERTA 🌷', 'ELA TÁ NA PROMO 👀',
    'UM PRESENTE PRA VOCÊ 🎁', 'AMIGAS, OLHA SÓ 👯‍♀️', 'NIVEL CAFETINA 💃',
    'SECRETINHO REVELADO 🤫', 'QUEM CUIDA SE DESTACA ✨', 'TÁ DE GRAÇA QUASE 🆓',
  ],

  // ── BELEZA MASCULINA ───────────────────────────────────────────────────────
  'beauty-m': [
    'MAIS UM 👊', 'TÔ VENDO QUE TÁ BOM 🤝', 'PEGA ENQUANTO TÁ 🎯',
    'CORRE QUE É IMPERDÍVEL 🏃', 'GASTOU CERTO 💸', 'NÃO PERDE TEMPO ⏱️',
    'PROMOÇÃO RELÂMPAGO ⚡', 'NA REAL VALE A PENA 👀', 'GUERREIRO, OLHA AÍ 💪',
    'PRA QUEM SE CUIDA 🧔', 'CHEIRO BOM = SUCESSO 🥇', 'INVESTIMENTO QUE RETORNA 💯',
    'AMIGO, PEGA ANTES QUE ACABE 🤙', 'TÁ NA HORA DE SE DAR BEM 🍀', 'COMPRA INTELIGENTE 🧠',
    'POR ESSE PREÇO? FECHOU 🤝', 'SEM ENROLAÇÃO, É PROMO 💥', 'BARBA E ESTILO ON 💈',
    'PERFUMARIA EM OFERTA 🌬️', 'CHEIRINHO MARCANTE 🎯', 'PRA IMPRESSIONAR 😎',
    'PROMOÇÃO HOMEM-ALFA 🦁', 'DESCONTASSO 💸', 'ARROZ-DE-FESTA 🤵',
    'GENTE FINA TEM ISSO ☝️', 'NÃO É CARO PRA CARALHO HOJE 🙏', 'OPORTUNIDADE BOA 🎲',
    'SAIU BARATO BARATO 🪙', 'PEGA ESSE 🚀', 'MELHOR PREÇO DO MÊS 📅',
    'TÁ NA PROMO ÚLTIMA HORA ⏰', 'NEGOCIO REDONDO 🎯', 'PRA QUEM SE LIGA 🔌',
  ],

  // ── MODA FEMININA ──────────────────────────────────────────────────────────
  'fashion-f': [
    'TÁ DIVA NESSA 👗', 'LOOK NOVO CHEGANDO ✨', 'OLHA QUE FOFÍSSIMO 🎀',
    'ARRASA NESSE 💃', 'MEU GUARDA-ROUPA AGRADECE 🙏', 'PEÇA DESEJO 💝',
    'TÁ A CARA DO VERÃO ☀️', 'STYLE NA VEIA 💁‍♀️', 'PRECIOSIDADE 💎',
    'TÔ COMPRANDO É AGORA 🛒', 'PRECIO MILAGROSO 🪄', 'OFERTA QUE BRILHA ✨',
    'NÃO É CARO NÃO MULHERADA 🎉', 'CORREEE 🏃‍♀️💨', 'AMIGAS, COMPREM JUNTAS 👯‍♀️',
    'PRA SAIR ARRASANDO 🔥', 'LOOKINHO DOS SONHOS 💭', 'TÁ DEMAIS 😍',
    'EU TÔ ENCANTADA 🥹', 'PEÇA-CHAVE 🗝️', 'INVESTIMENTO EM ESTILO 💼',
    'ELA TÁ LINDA 💕', 'PEÇA QUE GIRA NO ARMÁRIO 🔁', 'CLOSET UPGRADE ⬆️',
    'OS DEUSES DO PREÇO BENEFICIARAM 🙌', 'NÃO ME SEGURA 💃', 'STYLE GIRL CHEGOU 👑',
    'PRA TODAS AS OCASIÕES 🎭', 'OPÇÃO CORINGA 🃏', 'COMBINA COM TUDO 🌈',
    'PRINCESA, OLHA AQUI 👸', 'TÁ NA PROMO DA SEMANA 📆', 'FECHADO POR ESSE PREÇO 🤝',
  ],

  // ── MODA MASCULINA ─────────────────────────────────────────────────────────
  'fashion-m': [
    'PEÇA TOP DE LINHA 🔝', 'GUARDA-ROUPA PRECISA DISSO 👔', 'STYLE NA VEIA 💯',
    'PEGA ANTES QUE ACABE 🏃', 'GUERREIRO, OLHA AQUI 💪', 'PROMOÇÃO DECENTE 🤝',
    'INVESTIMENTO QUE VALE 💼', 'TÁ COM CARA DE CARO MAS NÃO TÁ 😏', 'COMPRA CERTA 🎯',
    'AMIGO, ESSE TÁ BOM 🤙', 'PRA SAIR BEM VESTIDO 🤵', 'CHEGOU PRA FICAR ⏳',
    'OPORTUNIDADE BOA 🎲', 'PEÇA-CORINGA 🃏', 'COMBINA COM TUDO 🎨',
    'ELEGANTE SEM SER CHATO 🧐', 'PRA DOMINGO E SEXTA 🗓️', 'CONFORTO + ESTILO 👌',
    'CLOSET UPGRADE ⬆️', 'GENTE FINA TEM ☝️', 'PRECIO REDONDO 💸',
    'PROMO QUE NÃO VOLTA 🚪', 'TIRA O CARTÃO 💳', 'SEM ENROLAÇÃO É PROMO 💥',
    'PEÇA QUE GIRA 🔁', 'BÁSICO BEM FEITO 👍', 'CARA DE ROUPA CARA 😉',
    'OFERTA DA SEMANA 📅', 'NA VITRINE ERA O TRIPLO 😱', 'PEGA ESSE BARATINHO 🪙',
    'VIAJANTE, OLHA AÍ ✈️', 'PRA TRABALHAR OU CURTIR 🎉', 'COMPRA INTELIGENTE 🧠',
  ],

  // ── TECH / GADGETS ─────────────────────────────────────────────────────────
  'tech': [
    'GADGET DESCE A LISTA 🔥', 'TECH NERDS REUNAM 🤓', 'BAIXOU O PREÇO 📉',
    'PEGA ANTES DE SUBIR 📈', 'OFERTA RELÂMPAGO ⚡', 'SETUP UPGRADE 🖥️',
    'AMANTES DE TECNOLOGIA 💻', 'NÃO É FÁCIL ACHAR ASSIM 🔍', 'TÁ PRA PEGAR 🎯',
    'INVESTIMENTO COM RETORNO 💯', 'NOVIDADE EM PROMO 🎉', 'EU JÁ COMPREI 🤓',
    'PROMOÇÃO MATA-MATA 🎯', 'BLACK SEM SER NOVEMBRO 🖤', 'PRECIO BANHEIRO 🚿',
    'NUNCA TÁ BARATO ASSIM 😱', 'GAMER, OLHA AQUI 🎮', 'PRODUTIVIDADE EM ALTA 📊',
    'CASA INTELIGENTE 🏠', 'WORK FROM HOME COM ESTILO 💼', 'AGUENTA O TRANCO 💪',
    'TECNOLOGIA QUE VALE 🤝', 'DESCONTO QUE DOI NO ML 😅', 'PROMO LANÇOU AGORA ⏰',
    'ALGUÉM ESQUECEU DE COBRAR PREÇO 🤔', 'NIVEL PROFISSIONAL 🏆', 'BOMBA TECNOLÓGICA 💣',
    'STREAMER APROVOU 🎥', 'PRA PROFISSIONALIZAR O SETUP 🔌', 'CABE NO BOLSO 💸',
    'OFERTA DA SEMANA 📅', 'CORRE QUE TÁ ACABANDO 🏃', 'TÁ NA PROMO PERFEITA 👌',
  ],

  // ── CELULARES ──────────────────────────────────────────────────────────────
  'cellphones': [
    'TROCA DE CELULAR? 📱', 'PROMOÇÃO TOP DE LINHA 🔝', 'CORRE QUE ACABA 🏃',
    'BAIXOU MUITO 📉', 'PRECIO REDONDO 🎯', 'NUNCA TÁ ASSIM 😱',
    'TECNOLOGIA NA MÃO 🤳', 'ATUALIZAÇÃO NA ÁREA 🆙', 'FOTOS MELHORES JÁ 📸',
    'PRA QUEM ESPERAVA 🎉', 'PEGA QUE TÁ BOM 🎯', 'OFERTAÇA 💥',
    'NÃO ROLA PERDER 🚫', 'DECISÃO CERTA 👍', 'INVESTIMENTO QUE DURA 🔋',
    'PEÇA DA SEMANA 📅', 'TÁ EM CONTA 💸', 'PRA TROCAR OU PRESENTEAR 🎁',
    'GAMER MOBILE APROVOU 🎮', 'TIROU DA GAVETA 🪄', 'BLACK CHEGOU CEDO 🖤',
    'ANUNCIO QUE BRILHA ✨', 'AVISA OS AMIGOS 📢', 'NÃO RESPONDO MENSAGEM AGORA, TÔ COMPRANDO 🛒',
    'SUPER UPGRADE 🔝', 'CONFIGURAÇÃO MONSTRA 💪', 'BATERIA QUE NÃO ACABA 🔋',
    'CÂMERA QUE IMPRESSIONA 📸', 'TELA QUE ENCHE OS OLHOS 👀', 'PROCESSADOR VELOZ 🏎️',
    'ARMAZENAMENTO À VONTADE 💾', 'NO BOLSO COMO REI 👑', 'DECISÃO RÁPIDA 🚀',
  ],

  // ── INFORMÁTICA ────────────────────────────────────────────────────────────
  'computing': [
    'SETUP NO PRÓXIMO NÍVEL 🖥️', 'PRODUTIVIDADE EM ALTA 📈', 'HOME OFFICE UPGRADE 💼',
    'GAMER, OLHA AQUI 🎮', 'STREAMER APROVOU 🎥', 'CRIADOR DE CONTEÚDO 🎨',
    'PRA TRABALHAR PESADO 💪', 'INVESTIMENTO COM RETORNO 💯', 'TECH UPGRADE ⬆️',
    'PROMOÇÃO BLACK SEM PRECISAR ESPERAR 🖤', 'PRECIO TOP 🎯', 'PEGA ANTES DE SUBIR 📈',
    'BAIXOU MUITO 📉', 'NUNCA TÁ ASSIM 😱', 'OFERTA RELÂMPAGO ⚡',
    'PERIFÉRICO QUE FALTAVA 🖱️', 'MONITOR DE PESO PESADO 🖥️', 'NOTEBOOK QUE AGUENTA 💻',
    'SSD PRO SISTEMA VOAR 🚀', 'MEMÓRIA EM PROMOÇÃO 💾', 'HD EXTERNO BARATÃO 💽',
    'WEBCAM PRA REUNIÃO 📹', 'HEADSET QUE NÃO PERDE 🎧', 'TECLADO MECÂNICO 🎹',
    'MOUSE DE PRECISÃO 🎯', 'PLACA QUE FAZ DIFERENÇA 🃏', 'PROCESSADOR FERAZ 🔥',
    'TÁ NA PROMO PERFEITA 👌', 'NIVEL PROFISSIONAL 🏆', 'OPORTUNIDADE QUE NÃO VOLTA 🚪',
    'EQUIPE DE GAMING APROVOU 🕹️', 'TECNOLOGIA QUE DURA ⏳', 'AGUENTA TRANCO 💪',
  ],

  // ── CASA / DECORAÇÃO ──────────────────────────────────────────────────────
  'home': [
    'CASA NOVA, CARA NOVA 🏠', 'DECORAR É AMAR 💕', 'CANTINHO ESPECIAL 🛋️',
    'AMBIENTE TRANSFORMADO 🪴', 'TOQUE FINAL DA CASA 🎀', 'OLHINHO PRA CASA 👀',
    'CASA INSTAGRAMÁVEL 📸', 'AQUECE O LAR ❤️', 'PRECIOSIDADE DOMÉSTICA 🏡',
    'DETALHE QUE FAZ DIFERENÇA ✨', 'COZY VIBE 🕯️', 'BOM GOSTO EM OFERTA 🍷',
    'DECORADORA INDICA 👩‍🎨', 'CASA CHEIA DE ESTILO 🎨', 'AFRESCO INTERIOR 🌿',
    'PRA RECEBER OS AMIGOS 🍷', 'AMBIENTE ACONCHEGANTE 🕯️', 'EU PRECISO DISSO 🙋‍♀️',
    'CASA OBRA-PRIMA 🖼️', 'PEÇA QUE TRANSFORMA ✨', 'OFERTA DA SEMANA 📅',
    'BAIXOU MUITO 📉', 'PROMO IRRESISTÍVEL 💎', 'COMPRA QUE ENCANTA 🌸',
    'PRINCESA, OLHA AQUI 👸', 'CASA VAI SE DESTACAR 🌟', 'COMBINA COM TUDO 🌈',
    'CADA AMBIENTE GANHA 🎯', 'TROCA SIMPLES, IMPACTO ENORME 💥', 'AMBIENTE NOVINHO ⭐',
    'PRECIO QUE DECORA 💰', 'TIROU DAS FOTOS DE REVISTA 📰', 'CARA DE LOJA CARA 😍',
  ],

  // ── COZINHA ────────────────────────────────────────────────────────────────
  'kitchen': [
    'COZINHEIRO DE PLANTÃO 👨‍🍳', 'CHEF AMADOR APROVOU 🍝', 'COZINHA DOS SONHOS 🌟',
    'FACILITA A VIDA 🙌', 'NÃO É DE GRAÇA MAS QUASE 🆓', 'PREPARO INTELIGENTE 🧠',
    'AIR FRYER, ASSADEIRA, TÁ TUDO 🍟', 'BOMBA NA COZINHA 💣', 'FAMÍLIA AGRADECE 👨‍👩‍👧',
    'PRA AGRADAR A SOGRA 🥘', 'NOVO BRINQUEDO 🪅', 'PREPARO RÁPIDO ⚡',
    'NÃO SEPARA DA RECEITA 📖', 'COZINHA UPGRADE ⬆️', 'OFERTA QUEBRA-PRATO 🍽️',
    'TUDO FRESCO 🥗', 'OS TEMPEROS VÃO COMEMORAR 🌶️', 'PRESENTE GRINGO 🎁',
    'CHEF DA CASA EM AÇÃO 👩‍🍳', 'PRATO PRINCIPAL ⭐', 'CASA CHEIRA BEM 🍰',
    'PROMOÇÃO QUE NÃO QUEIMA 🔥', 'GASTRONOMIA EM PROMO 🍷', 'COMBINA COM RECEITAS 🥘',
    'PREÇO PRO BOLSO 💸', 'COZINHA FELIZ 😊', 'NIVEL MASTERCHEF 🏆',
    'CONVITES PRO ALMOÇO 🍴', 'JANTAS ESPECIAIS 🍽️', 'CAFÉ DA MANHÃ DE HOTEL ☕',
    'DECORAÇÃO + UTILIDADE 🎨', 'BAIXOU MUITO 📉', 'OFERTA NÃO PERDE 🎯',
  ],

  // ── ELETRODOMÉSTICOS ──────────────────────────────────────────────────────
  'appliances': [
    'CASA UPGRADE 🏠', 'ELETRODOM QUE FALTAVA ⚡', 'INVESTIMENTO LONGO PRAZO 💯',
    'TROCAR VALE A PENA 🤝', 'PROMOÇÃO BLACK 🖤', 'OUTLET BARATINHO 🛍️',
    'PEGA QUE TÁ BOM 🎯', 'FACILITA O DIA A DIA 🌅', 'CASA ORGANIZADA 🧹',
    'PRECIO INACREDITÁVEL 😱', 'NUNCA TÁ ASSIM 🙏', 'CONSUMO BAIXO, EFICIÊNCIA ALTA 🌱',
    'FAMÍLIA AGRADECE 👨‍👩‍👧', 'DESCANSO DA DONA DA CASA 👩‍🦰', 'ALÔ, MARIDO, OLHA AQUI 📞',
    'NÃO ROLA PERDER 🚫', 'BAIXOU MUITO 📉', 'PROMOÇÃO ESQUECIDA ⏰',
    'CASA INTELIGENTE 🤖', 'AGUENTA DÉCADAS 🛡️', 'OFERTA QUEBRA-MULHER 💎',
    'GELADEIRA, FOGÃO, TÁ TUDO 🛍️', 'COMPROU CERTO 🤝', 'PRESENTE DE CASAMENTO 🎁',
    'CONFORTO QUE COMPRA SE PAGA 💰', 'CASA PRODUZ 🏭', 'TROCA CERTA 🔄',
    'INVESTIMENTO QUE DURA 🛠️', 'DECISÃO ESPERTA 🧠', 'PROMO DA ESTAÇÃO 🌸',
    'ENERGIA EFICIENTE 💡', 'GARANTIA + PROMO 🛡️💰', 'CARRINHO ENCHE SOZINHO 🛒',
  ],

  // ── FITNESS FEMININO ──────────────────────────────────────────────────────
  'fitness-f': [
    'CORPO EM EVOLUÇÃO 💪', 'GUERREIRA, OLHA AQUI 👊', 'TREINO COM ESTILO 🔥',
    'PROJETO VERÃO ON ☀️', 'AMIGAS, JUNTAS NA ACADEMIA 👯‍♀️', 'AUTOCUIDADO TOTAL 🧘‍♀️',
    'LEGGING DOS SONHOS 💖', 'TOP QUE NÃO MARCA 🎯', 'CONJUNTO COMPLETO 👚',
    'TÊNIS PRA ESTOURAR ⚡', 'PROMO QUE MOVE 💃', 'FITNESS NA MODA 🏃‍♀️',
    'MUSCULATURA TOPISSIMA 💪', 'TÁ NA HORA DE BORA 🚀', 'BAIXOU MUITO 📉',
    'CASE COM EU 💕', 'EU JÁ COMPREI 🙋‍♀️', 'TREINO MELHOR COM ROUPA BOA 👌',
    'WHEY EM PROMO 🥤', 'SUPLEMENTO PRO TOP 🏆', 'FORÇA EM ALTA 💯',
    'WORKOUT VIBE 🔥', 'AMOR PRÓPRIO + SAÚDE 💕', 'NÃO É VAIDADE É CUIDADO 🧘‍♀️',
    'OFERTAÇA DE TREINO ⚡', 'PROJETO BIQUÍNI ATIVO 👙', 'FITGIRLS, ATIVAR ALERTA 🔔',
    'DESCONTO QUE TONIFICA 💪', 'NÃO É CARO É INVESTIMENTO 💰', 'MUSCULAÇÃO ON 🏋️‍♀️',
    'YOGA, PILATES, CROSSFIT 🧘‍♀️', 'TUDO QUE PRECISA 📋', 'PEGA E TREINA 💨',
  ],

  // ── FITNESS MASCULINO ─────────────────────────────────────────────────────
  'fitness-m': [
    'BORA TREINAR 💪', 'GUERREIRO, OLHA AQUI 👊', 'PUMPER ON 🏋️',
    'PROJETO HIPERTROFIA 📈', 'BÍCEPS BRAVO 💪', 'TREINO PESADO 🏋️‍♂️',
    'SUPLEMENTO DECENTE 🥤', 'WHEY EM PROMO 💯', 'CREATINA BARATINHA 🪙',
    'TÊNIS PRA ESTOURAR 🔥', 'SHORT DE TREINO 🩳', 'DRY FIT NA ÁREA 🌬️',
    'MACHO ALPHA APROVA 🦁', 'NIVEL ARNOLD 💪', 'GYM RAT FEAT 🐀',
    'BAIXOU MUITO 📉', 'NUNCA TÁ ASSIM 😱', 'TREINO MELHORADO 💪',
    'KIT COMPLETO PRA ACADEMIA 🎒', 'INVESTIMENTO MUSCULAR 💰', 'BORA ATIVAR 🚀',
    'COMPRA DE GUERREIRO 🛡️', 'NÃO É PROMO É BÊNÇÃO 🙏', 'GAINS GARANTIDOS 📊',
    'PRODUTO RECOMENDADO 🤝', 'PEGUEI DOIS 🤲', 'TÁ NA PROMOÇÃO PERFEITA 👌',
    'FAMÍLIA FITNESS 👨‍👩‍👧', 'BÔNUS DE TREINO 🎁', 'PRA QUEM SE LEVA A SÉRIO 💯',
    'OFERTA QUE FORTALECE 💪', 'DESCONTAÇO 💸', 'NIVEL PRO 🏆',
  ],

  // ── SUPLEMENTOS ────────────────────────────────────────────────────────────
  'supplements': [
    'WHEY EM PROMO 🥤', 'CREATINA NO PREÇO 💪', 'SUPLEMENTO TOP 🏆',
    'TREINO REQUER ⚙️', 'GAINS GARANTIDOS 📊', 'INVESTIMENTO MUSCULAR 💰',
    'PRA QUEM LEVA A SÉRIO 💯', 'PERFORMANCE EM ALTA 📈', 'RECUPERAÇÃO TOPISSIMA 💪',
    'BCAA EM CONTA 🧪', 'GLUTAMINA EM PROMO ⚡', 'COLÁGENO POR ESSE PREÇO 😱',
    'PRÉ-TREINO ROARRR 🦁', 'OMEGA 3 SAÚDE 🐟', 'VITAMINA COMPLETA 💊',
    'IMUNIDADE FORTE 🛡️', 'BAIXOU MUITO 📉', 'PROMO DO MÊS 📅',
    'SAÚDE EM PRIMEIRO LUGAR 💚', 'NUTRIÇÃO SÉRIA 🍎', 'CORPO AGRADECE 🙏',
    'TREINO MELHORA 💪', 'GAINS ON FIRE 🔥', 'ATLETA APROVA 🏃',
    'FITGIRL SUPER 💕', 'BÔNUS ENERGIA ⚡', 'KIT COMPLETO 🎒',
    'OFERTA QUE FORTALECE 💪', 'NÃO É CARO É INVESTIMENTO 💰', 'TOMOU = SENTIU 🎯',
    'COMO VITAMINAR 🧪', 'CIENCIA DA NUTRIÇÃO 🔬', 'EFEITO REAL ✅',
  ],

  // ── BEBÊS ──────────────────────────────────────────────────────────────────
  'babies': [
    'PRA BEBÊ DA CASA 👶', 'MAMÃE APROVOU 🤱', 'PROMO MARAVILHOSA 💕',
    'ENXOVAL UPGRADE 👼', 'CUIDADO COM CARINHO 🍼', 'FAMÍLIA AGRADECE 👨‍👩‍👦',
    'AMORZINHO PRECISA 💝', 'PRINCIPE/PRINCESA EM CASA 👑', 'CONFORTO PRO PEQUENO 🧸',
    'PROMOÇÃO DO COROAÇÃO 💗', 'NÃO TEM PREÇO O CUIDADO 🌟', 'PRA SOBRINHA QUERIDA 🎁',
    'CHÁ DE BEBÊ PRESENTE 🎀', 'NEM NA LIQUIDAÇÃO ASSIM 😱', 'TUDO QUE PRECISA 📋',
    'BAIXOU MUITO 📉', 'OFERTA DE OURO 🌟', 'SEGURANÇA + ECONOMIA 🛡️💰',
    'PEQUENINO MERECE 💝', 'TROUXEMOS PRA VOCÊ 🚚', 'CARINHO QUE EMBALA 🌟',
    'DICA DE OURO 🌟', 'PRESENTE QUE EMOCIONA 😍', 'GENTE FINA TEM ☝️',
    'SUPER PROMOÇÃO MÃES 👩‍👧', 'DESCANSO PRA MAMÃE 😴', 'CONFORTINHO TOTAL 🛏️',
    'PRA O CRESCIMENTO 🌱', 'INVESTIMENTO EM FAMÍLIA 👨‍👩‍👧', 'PROMO TÁ NA HORA ⏰',
    'PRINCESA/PRÍNCIPE EM CASA 👑', 'BERÇO E AFINS 🛏️', 'CUIDADO BEBE 💝',
  ],

  // ── PET ─────────────────────────────────────────────────────────────────────
  'pets': [
    'PET MERECE O MELHOR 🐶', 'RAÇÃO EM PROMO 🥩', 'CACHORRO/GATO LIBERA 🐱',
    'AMIGUINHOS DE 4 PATAS 🐾', 'PETSHOP EM CASA 🏡', 'CUIDADO ANIMAL 💝',
    'DONO/A APROVOU 🙋', 'PROMO QUE LATIO 🐕', 'NÃO É BARATO ASSIM SEMPRE 😱',
    'PROMO DA CASINHA 🏠', 'PETZINHO ALEGRE 🎾', 'TUDO PRA O AMIGÃO 🌟',
    'INVESTIMENTO EM SAÚDE 💊', 'BRINQUEDO EM PROMO 🎾', 'COMEDOURO EM CONTA 🍽️',
    'CAMA PET BARATINHA 🛏️', 'AREIA EM PROMO 🐱', 'ANTIPULGAS BARATO 🦟',
    'BAIXOU MUITO 📉', 'NUNCA TÁ ASSIM 😱', 'PET FELIZ 😊',
    'COROA APROVOU 🐩', 'GATO RONRONOU 🐾', 'OLHINHO BRILHOU 👁️',
    'PETLOVER LIBERA 💕', 'TUDO PRA CUIDAR DELE/A 🌟', 'PRESENTÃO 🎁',
    'AMOR PETZÃO 💝', 'PEÇA QUE FACILITA 🎯', 'PROMOÇÃO QUE PETLAR 🏡',
    'PEGUEI DOIS 🤲', 'PROMO MELHOR DO MÊS 📅', 'PRA CADELINHA/GATINHA QUERIDA 💖',
  ],

  // ── GERAL (fallback) ───────────────────────────────────────────────────────
  'general': [
    'MAIS UM 👇', 'OLHA SÓ ESSA 👀', 'CORRE QUE É IMPERDÍVEL 🏃',
    'PROMOÇÃO RELÂMPAGO ⚡', 'NÃO DEIXA ESCAPAR 💸', 'OFERTA QUENTE 🔥',
    'PEGA ENQUANTO TÁ NESSE PREÇO 🎯', 'BAIXOU MUITO 📉', 'NUNCA TÁ ASSIM 😱',
    'PROMOÇÃO DESSA NÃO TEM SEMPRE 🌟', 'OFERTA TOP 💎', 'PRECIO REDONDO 🎯',
    'BLACK SEM SER NOVEMBRO 🖤', 'TÁ NA PROMO DA SEMANA 📅', 'OPORTUNIDADE BOA 🎲',
    'PEGA QUE TÁ BOM 🎯', 'EU JÁ PEDI 🛒', 'AVISA OS AMIGOS 📢',
    'OFERTA SURPREENDENTE 😲', 'SUPER DESCONTO 💸', 'INVESTIMENTO QUE VALE 💯',
    'BOMBA DA SEMANA 💣', 'NUM ESPERA PRA AMANHÃ 🚀', 'COMPRA INTELIGENTE 🧠',
    'TIROU DO BOLSO 💵', 'TÁ DE GRAÇA QUASE 🆓', 'PROMOÇÃO IMPERDÍVEL ⏰',
    'NÃO PRECISA PENSAR DUAS VEZES 🤝', 'OFERTA QUE BRILHA ✨', 'DIA DE SORTE 🍀',
    'GENTE FINA TEM 👍', 'PEGOU? 🎯', 'CARRINHO BORA 🛒',
  ],
};

// ============================================================================
// SUB-NICHOS por palavra-chave no título (refinamento)
// ============================================================================

/**
 * Detecta sub-nicho baseado em keywords no título.
 * Retorna conjunto de hooks/closers extras pra usar (mistura com nicho base).
 */
const SUB_NICHE_HOOKS = {
  // Sub: cabelo (beauty-f)
  cabelo: [
    'CABELO DOS SONHOS ✨', 'FIO BRILHANTE 💁‍♀️', 'CACHEADA, LISA, TUDO 🎀',
    'PROGRESSIVA EM PROMO 💆‍♀️', 'TRATAMENTO CAPILAR 💕', 'CRESCE FORTE 🌱',
    'NÃO É SHAMPOO QUALQUER 🥇', 'CACHO PEFEITO 🌀',
  ],
  // Sub: maquiagem
  maquiagem: [
    'MAKE ON POINT 💄', 'GLOSS NA ÁREA 💋', 'BASE QUE NÃO MARCA 🎨',
    'PALETA QUE VICIA 🎨', 'EYELINER PERFEITO 👁️', 'BLUSH NATURAL 🌸',
    'MAQUIAGEM PRO DIA A DIA 💖', 'GLAM PRA FESTA 👑',
  ],
  // Sub: perfume
  perfume: [
    'CHEIRINHO MARCANTE 🌬️', 'ESSÊNCIA INESQUECÍVEL 🥀', 'AROMA DE LUXO 💎',
    'DEIXA RASTRO 💨', 'PERFUMARIA EM PROMO 🌷', 'IMPRESSIONA QUEM PASSA 😍',
  ],
  // Sub: skincare
  skincare: [
    'PELE NA GLOW UP ✨', 'SÉRUM MILAGRE 🪄', 'HIDRATANTE QUE FAZ DIFERENÇA 💧',
    'ANTI-IDADE EM CONTA ⏳', 'ROTINA DE SKINCARE 🧴', 'PELE LISINHA 🌸',
  ],
  // Sub: barba (beauty-m)
  barba: [
    'BARBA NA ÁREA 💈', 'CUIDADO COM A BARBA 🧔', 'KIT BARBEIRO 🪒',
    'BALM QUE HIDRATA 💧', 'ÓLEO PRA BARBA TOP 🥇',
  ],
  // Sub: roupa íntima/lingerie (fashion-f)
  lingerie: [
    'LINGERIE LINDA 🌸', 'CONJUNTINHO LINDO 💕', 'SENSUAL E CONFORTÁVEL 💋',
    'PEÇA DE LUXO POR POUCO 💎',
  ],
  // Sub: tênis
  tenis: [
    'TÊNIS NA PROMO 👟', 'CONFORTO PRO PÉ 🦶', 'COMBINA COM TUDO 🌈',
    'CALÇA NO PÉ ⚡', 'CAIXA NOVINHA 📦', 'TÊNIS DOS SONHOS ✨',
  ],
  // Sub: fone/headphone (tech)
  fone: [
    'SOM PROFISSIONAL 🎧', 'BASS DE SE EMOCIONAR 🎵', 'CANCELAMENTO DE RUÍDO 🔇',
    'TRANSMISSÃO LIMPA 📡', 'BATERIA QUE DURA ⏳', 'CONFORTO NO OUVIDO 👂',
  ],
  // Sub: smartwatch
  smartwatch: [
    'PULSO INTELIGENTE ⌚', 'MONITORA SAÚDE 💓', 'NOTIFICAÇÃO NA HORA 📲',
    'BATERIA QUE DURA DIAS 🔋', 'ESTILO E TECNOLOGIA 🎯',
  ],
  // Sub: notebook
  notebook: [
    'NOTEBOOK FERAZ 💻', 'TRABALHO PESADO 💼', 'GAMER MOBILE 🎮',
    'STREAM E EDIÇÃO 🎥', 'PRODUTIVIDADE TOTAL 📈',
  ],
  // Sub: panela/cozinha
  panela: [
    'COZINHA DE CHEF 👨‍🍳', 'PANELA QUE NÃO GRUDA 🍳', 'AGUENTA FOGO ALTO 🔥',
    'JANTAR DE GALA 🍽️', 'RECEITA FÁCIL 📖',
  ],
  // Sub: airfryer
  airfryer: [
    'FRITURA SEM ÓLEO 🍟', 'CROCANTE POR DENTRO E POR FORA 🍗', 'PRATICIDADE TOTAL ⚡',
    'COZINHA DA SAÚDE 🥗', 'CALOR EM SEGUNDOS 🌡️',
  ],
  // Sub: bicicleta ergométrica/esteira (fitness)
  bicicleta: [
    'CARDIO EM CASA 🚴‍♀️', 'TREINO SEM IR PRA RUA 🏠', 'GASTA CALORIA SEM SAIR 🔥',
    'CINTURA REDUZIDA 📉', 'PROJETO BIKE 🚴',
  ],
  esteira: [
    'CORRIDA EM CASA 🏃', 'CARDIO INTENSO 💓', 'PROJETO CORREDOR 🥇',
    'TREINO TODA HORA ⏰',
  ],
};

// ============================================================================
// PRICE OPENERS / "NOW" PHRASES
// ============================================================================

const PRICE_OPENERS = [
  'De', '~De~', 'Era', 'Saiu de', 'Estava', 'Custava', 'Antes',
  'O preço cheio',
];
const PRICE_NOW = [
  'por', 'agora por', 'só', 'apenas', 'sai por', 'cai pra',
  'baixou pra', 'tá em', 'fechado em',
];

// ============================================================================
// CLOSERS (20+ por nicho)
// ============================================================================

const CLOSERS = {
  'beauty-f': [
    'Aproveite enquanto tem 💕', 'Você merece! ✨', 'Garanta o seu antes que acabe 💖',
    'Promoção tem hora 🕐', 'Tá esperando o quê? 🤔', 'Não fica pra amanhã 🚀',
    'Compra esperta 💡', 'Princesa, garante 👑', 'Cuida de você 🌸',
    'Vai esperar acabar? 😅', 'Beleza não tem preço 💎', 'Pra ficar deusa 👸',
    'Olha o time todo aprovando 👯‍♀️', 'É um beijinho seu pra você 💋', 'Cuida do que importa 💝',
    'Glow up tá pronto ✨', 'O autocuidado começa hoje 🌷', 'Tem cupom no anuncio 🎟️',
    'Pega antes da fila aumentar 📈', 'Pra todas que se amam 💕',
  ],
  'beauty-m': [
    'Garante logo 🎯', 'Pega que tá bom 👌', 'Não enrola 🚀',
    'Compra inteligente 🧠', 'Tá na promo, vai 💸', 'Te falei que era bom 🤝',
    'Tá esperando o quê 🤔', 'Pega esse 🎯', 'Cuidar é viril 🧔',
    'Olha o desconto 💰', 'Promo não volta 🚪', 'Tira o cartão 💳',
    'Pegou? bom 👍', 'Quem se cuida se destaca 💯', 'Compra de homem-fino ☝️',
    'Garante pro próximo encontro 😎', 'Aproveita ⚡', 'Não vou repetir 🤷',
    'Promo terminando ⏰', 'Compra agora 🛒',
  ],
  'fashion-f': [
    'Garanta o seu antes que acabe 💝', 'Você merece esse look ✨', 'Vai brilhar 🌟',
    'Princesa, é seu! 👑', 'Pega 2 ou 3 💁‍♀️', 'Pra aproveitar todas as estações 🌷',
    'Olha que perfeito 💕', 'Linda demais 😍', 'Combina com tudo 🌈',
    'Outfit garantido 💃', 'Look completo ✨', 'Pega antes da concorrência 🏃‍♀️',
    'Tô conferindo no carrinho 🛒', 'Amiga, comprou 🤝', 'Promo show 🎉',
    'Eu já tô pra fechar 💳', 'Pra usar muito 💖', 'Não vai escapar 🏃',
    'Tem cupom no anuncio 🎟️', 'Pra todas que arrasam 💃',
  ],
  'fashion-m': [
    'Pega antes de subir 📈', 'Compra inteligente 🧠', 'Não vou repetir 🤷',
    'Garante logo 🎯', 'Pega que tá bom 👌', 'Promo não volta 🚪',
    'Tira o cartão 💳', 'Look pronto 👔', 'Combina com tudo 🎨',
    'Vai escapar? 👀', 'Promo terminando ⏰', 'Compra agora 🛒',
    'Tô conferindo aqui ✅', 'Olha o desconto 💰', 'Pra impressionar 😎',
    'Estilo + economia 💯', 'Investimento certo 💼', 'Pra ficar bem na fita 👍',
    'Cara de roupa cara 😉', 'Não rola perder 🚫',
  ],
  'tech': [
    'Tira o cartão 💳', 'Pra setup completo 🖥️', 'Investimento certo 💯',
    'Estoque limitado ⚠️', 'Configuração top 🏆', 'Pega antes de subir 📈',
    'Compra inteligente 🧠', 'Não vou repetir 🤷', 'Garante logo 🎯',
    'Tô comprando dois 🛒', 'Promo show 🎉', 'Estoque acabando ⚠️',
    'Pra o pc gamer da galera 🎮', 'Stream + edição 🎥', 'Produtividade em alta 📈',
    'Bater meta de gear 💪', 'Tecnologia que dura ⏳', 'Aguenta o tranco 💪',
    'Promo de Black sem ser novembro 🖤', 'Não rola perder 🚫',
  ],
  'cellphones': [
    'Garante seu novo cel 🎯', 'Pra trocar o celular 📱', 'Upgrade na hora 🆙',
    'Pega antes de subir 📈', 'Promo show 🎉', 'Tô conferindo aqui ✅',
    'Olha o desconto 💰', 'Promo terminando ⏰', 'Compra agora 🛒',
    'Pegou? bom 👍', 'Não vou repetir 🤷', 'Tira o cartão 💳',
    'Estoque limitado ⚠️', 'Câmera show 📸', 'Bateria que dura 🔋',
    'Tela imersiva 👀', 'Promo de Black 🖤', 'Vale a pena 💯',
    'Tô comprando 🛒', 'Garante pro próximo plano 📋',
  ],
  'computing': [
    'Pra setup pro 🏆', 'Investimento certo 💯', 'Produtividade em alta 📈',
    'Stream + game + edição 🎥', 'Pega antes de subir 📈', 'Tô comprando dois 🛒',
    'Promo Black sem ser novembro 🖤', 'Tira o cartão 💳', 'Não vou repetir 🤷',
    'Garante logo 🎯', 'Promo show 🎉', 'Estoque acabando ⚠️',
    'Bater meta de gear 💪', 'Pra trabalhar pesado 💼', 'Tecnologia que dura ⏳',
    'Aguenta tranco 💪', 'Compra inteligente 🧠', 'Olha o desconto 💰',
    'Não rola perder 🚫', 'Setup completo ⬆️',
  ],
  'home': [
    'Casa nova em 1 produto 🏡', 'Decora e arrasa ✨', 'Pra todos os ambientes 🪴',
    'Olha que detalhe 💕', 'Tô comprando 🛒', 'Casa instagramável 📸',
    'Promo show 🎉', 'Não rola perder 🚫', 'Garante logo 🎯',
    'Cantinho especial 🛋️', 'Pra receber bem 🍷', 'Estoque limitado ⚠️',
    'Compra inteligente 🧠', 'Casa de luxo por pouco 💎', 'Ambiente novinho ⭐',
    'Olha o desconto 💰', 'Promo terminando ⏰', 'Combina com tudo 🌈',
    'Investimento em conforto 💯', 'Vale demais 💕',
  ],
  'kitchen': [
    'Cozinha de chef 👨‍🍳', 'Pra arrasar nas receitas 🍝', 'Promo da semana 📅',
    'Tô comprando dois 🛒', 'Olha o desconto 💰', 'Pega antes de subir 📈',
    'Família agradece 👨‍👩‍👧', 'Pra cozinheiro de plantão 🍳', 'Não rola perder 🚫',
    'Estoque limitado ⚠️', 'Promo show 🎉', 'Garante logo 🎯',
    'Compra inteligente 🧠', 'Investimento na cozinha 🍽️', 'Praticidade total ⚡',
    'Aguenta o fogo 🔥', 'Não gruda a comida 🍳', 'Combina com receitas 🥘',
    'Pra todas as ocasiões 🎉', 'Cozinha upgrade ⬆️',
  ],
  'appliances': [
    'Investimento que dura ⏳', 'Casa upgrade 🏠', 'Pega antes de subir 📈',
    'Promo Black sem ser novembro 🖤', 'Tira o cartão 💳', 'Garante logo 🎯',
    'Compra inteligente 🧠', 'Família agradece 👨‍👩‍👧', 'Não rola perder 🚫',
    'Estoque limitado ⚠️', 'Promo show 🎉', 'Energia eficiente 💡',
    'Aguenta décadas 🛡️', 'Casa produz 🏭', 'Decisão esperta 🧠',
    'Conforto que se paga 💰', 'Garantia + promo 🛡️💰', 'Olha o desconto 💰',
    'Tô conferindo aqui ✅', 'Promo da estação 🌸',
  ],
  'fitness-f': [
    'Bora treinar! 💪', 'Pro projeto verão ☀️', 'Você merece esse upgrade ✨',
    'Treina com estilo 🔥', 'Pega antes de subir 📈', 'Promo show 🎉',
    'Tô comprando dois 🛒', 'Olha o desconto 💰', 'Garante logo 🎯',
    'Compra inteligente 🧠', 'Não rola perder 🚫', 'Estoque limitado ⚠️',
    'Conjunto completo 👚', 'Pra arrasar na academia 🏋️‍♀️', 'Workout vibe 🔥',
    'Saúde + estilo 💕', 'Treino fica melhor 💪', 'Amiga, junta na promo 👯‍♀️',
    'Pegou? top 👌', 'Projeto biquini ativo 👙',
  ],
  'fitness-m': [
    'Bora treinar! 💪', 'Hipertrofia on 📈', 'Pega antes de subir 📈',
    'Promo show 🎉', 'Tô comprando dois 🛒', 'Olha o desconto 💰',
    'Garante logo 🎯', 'Compra inteligente 🧠', 'Não rola perder 🚫',
    'Estoque limitado ⚠️', 'Pro próximo treino 🏋️‍♂️', 'Gains garantidos 📊',
    'Investimento muscular 💰', 'Compra de guerreiro 🛡️', 'Pegou? top 👌',
    'Treino melhorou 💪', 'Pra quem leva a sério 💯', 'Bora ativar 🚀',
    'Promo terminando ⏰', 'Nível Arnold 💪',
  ],
  'supplements': [
    'Performance em alta 📈', 'Gains garantidos 📊', 'Saúde em primeiro lugar 💚',
    'Pega antes de subir 📈', 'Tô comprando dois 🛒', 'Olha o desconto 💰',
    'Garante logo 🎯', 'Compra inteligente 🧠', 'Não rola perder 🚫',
    'Estoque limitado ⚠️', 'Promo show 🎉', 'Treino requer ⚙️',
    'Recuperação topíssima 💪', 'Imunidade forte 🛡️', 'Nutrição séria 🍎',
    'Corpo agradece 🙏', 'Atleta aprova 🏃', 'Bônus de energia ⚡',
    'Investimento muscular 💰', 'Tomou = sentiu 🎯',
  ],
  'babies': [
    'Bebê merece o melhor 💝', 'Mamãe aprova 🤱', 'Carinho que embala 🌟',
    'Família agradece 👨‍👩‍👦', 'Pega antes de subir 📈', 'Promo show 🎉',
    'Garante logo 🎯', 'Compra inteligente 🧠', 'Não rola perder 🚫',
    'Estoque limitado ⚠️', 'Princesinha/Príncipe em casa 👑', 'Conforto pro pequeno 🧸',
    'Pra o crescimento 🌱', 'Olha o desconto 💰', 'Tô conferindo aqui ✅',
    'Investimento em família 👨‍👩‍👧', 'Cuidado com carinho 🍼', 'Presente que emociona 😍',
    'Pra sobrinha querida 🎁', 'Promo da semana 📅',
  ],
  'pets': [
    'Pet feliz 🐾', 'Dono que ama 💝', 'Amigo de 4 patas merece 🐶',
    'Pega antes de subir 📈', 'Promo show 🎉', 'Garante logo 🎯',
    'Compra inteligente 🧠', 'Não rola perder 🚫', 'Estoque limitado ⚠️',
    'Petshop em casa 🏡', 'Olha o desconto 💰', 'Tô conferindo aqui ✅',
    'Pra dele/dela 💕', 'Investimento em saúde 💊', 'Cuidado animal 💝',
    'Petlover libera 💕', 'Olhinho brilhou 👁️', 'Latiu de felicidade 🐕',
    'Ronronou de gosto 🐈', 'Promo melhor do mês 📅',
  ],
  'general': [
    'Aproveite enquanto dura ⏰', 'Não fica pra amanhã 🚀', 'Compra esperta 💡',
    'Garanta antes de subir 📈', 'Pega antes de acabar 🏃', 'Promo show 🎉',
    'Olha o desconto 💰', 'Tô conferindo aqui ✅', 'Estoque limitado ⚠️',
    'Não rola perder 🚫', 'Compra inteligente 🧠', 'Garante logo 🎯',
    'Promo terminando ⏰', 'Tira o cartão 💳', 'Vale demais 💯',
    'Investimento certo 💯', 'Tô comprando 🛒', 'Pegou? top 👌',
    'Não vou repetir 🤷', 'Promo da semana 📅',
  ],
};

// ============================================================================
// GATILHOS ESPECIAIS (sobrescreve hook se aplicável)
// ============================================================================

const TRIGGER_HOOKS = {
  // Desconto pesado (>= 50%)
  bigDiscount: [
    'METADE DO PREÇO 🤯', 'DÓI DE TÃO BARATO 😱', 'CHOREI DE BARATO 😭',
    'CAIU EM 50%+ 💥', 'OLHA ESSE DESCONTÃO 💸', 'NEM PRECISA OLHAR DUAS VEZES 👀',
    'ABSURDO DE BARATO 🚨', 'MEU CARTÃO TÁ FUMACANDO 💳🔥', 'É HOJE QUE EU GASTO 💰',
    'DESCONTO ABSURDO 🤯', 'OFERTA DA DÉCADA 🏆', 'NÃO É ERRO DO ML, É REAL 😅',
  ],
  // Tem cupom
  hasCoupon: [
    'NÃO ESQUECE O CUPOM 🎟️', 'CUPOM NO ANÚNCIO 🎟️', 'APLICA O CUPOM AÍ 🎫',
    'CUPOM = ECONOMIA EXTRA 💸', 'CUPOM ATIVO 🎟️', 'EXTRA NO CUPOM 🎁',
    'CONFIRA O CUPOM 👀', 'NÃO ESQUECE DE APLICAR 🪙', 'CUPOM RAPIDIM 🎫',
  ],
  // Mais Vendido / Oferta do Dia
  hotItem: [
    'TODO MUNDO TÁ COMPRANDO 🏃', 'BOMBA DE VENDAS 💣', 'NÃO TÔ AGUENTANDO ESSE SUCESSO 🔥',
    'OFERTA DO DIA NO ML ⭐', 'MAIS VENDIDO POR UM MOTIVO 🏆', 'SELO DE OFERTA DO DIA 🌟',
    'SUCESSO TOTAL DO ML 📈', 'GENTE DIVULGANDO POR AÍ 📢', 'OS COMENTÁRIOS APROVAM 👍',
  ],
  // Preço baixo (<= 50)
  cheap: [
    'POR ESSE PREÇO? FECHADO 🤝', 'BAIXOU MUITO 📉', 'TÁ DE GRAÇA QUASE 🆓',
    'PEGA 2, 3, 4 🛒', 'BARATIN BARATIN 🪙', 'CUSTA MAIS UM CAFEZINHO ☕',
    'NEM PENSA DUAS VEZES 🧠', 'BOM POR ESSE PREÇO 💸', 'CABE NO BOLSO 💸',
  ],
  // Preço alto (>= 500) — premium
  premium: [
    'INVESTIMENTO QUE VALE 💰', 'PRA QUEM PROCURA QUALIDADE 🏆', 'TOP DE LINHA 🔝',
    'NIVEL PROFISSIONAL 💼', 'CUSTA MAIS, MAS VALE CADA REAL 💎', 'PEÇA-DESEJO 💝',
    'PRA QUEM SE LEVA A SÉRIO 💯', 'PRECIOSIDADE 💎', 'NIVEL PREMIUM 👑',
  ],
};

const TRIGGER_CLOSERS = {
  bigDiscount: [
    'Desconto desses não tem todo dia 🌟', 'Tá brincando que tá nesse preço 😅',
    'Vai voltar de R$ ASTRONÔMICO em breve 🚀', 'Aproveita antes de subir 📈',
  ],
  hasCoupon: [
    'Cupom + promo = combo perfeito 🎟️💰', 'Não esquece de aplicar o cupom 🎫',
    'Confere o cupom no anuncio 👀',
  ],
  hotItem: [
    'Tá vendendo demais, corre 🏃', 'Mais vendido = qualidade aprovada 👍',
    'Já é febre, garante 📈',
  ],
};

// ============================================================================
// API EXPORTADA
// ============================================================================

function strHash(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function pickFrom(arr, seed = '') {
  if (!arr || arr.length === 0) return '';
  const idx = (strHash(seed) + Math.floor(Math.random() * 100)) % arr.length;
  return arr[idx];
}

/**
 * Detecta sub-nicho pelo título do produto.
 * Retorna chave de SUB_NICHE_HOOKS ou null.
 */
function detectSubNiche(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  const checks = [
    ['perfume', /(perfume|eau de|colônia|colonia|body splash)/],
    ['skincare', /(sérum|serum|hidratante facial|anti-?idade|skincare|protetor solar)/],
    ['maquiagem', /(maquiagem|batom|gloss|sombra|paleta|blush|base \w|primer|contorno|iluminador|rímel|rimel|eyeliner|delineador)/],
    ['cabelo', /(cabelo|shampoo|condicionador|máscara capilar|leave-in|progressiva|alisador|escova)/],
    ['barba', /(barba|aparador|navalha|óleo barba|balm barba)/],
    ['lingerie', /(lingerie|sutiã|sutia|calcinha|biquíni|biquini|maiô|maio)/],
    ['tenis', /(tênis|tenis|t[êe]nis|sapatilha)/],
    ['fone', /(fone|headphone|earbud|headset|airpod)/],
    ['smartwatch', /(smartwatch|smart watch|mi band|apple watch|amazfit)/],
    ['notebook', /(notebook|laptop|ultrabook)/],
    ['airfryer', /(air ?fryer|fritadeira)/],
    ['panela', /(panela|frigideira|wok)/],
    ['bicicleta', /(bicicleta|ergom[ée]trica|spinning)/],
    ['esteira', /(esteira)/],
  ];
  for (const [name, re] of checks) {
    if (re.test(t)) return name;
  }
  return null;
}

/**
 * Detecta gatilhos especiais aplicáveis pra essa oferta.
 */
function detectTriggers(offer) {
  const triggers = [];
  if (offer.discountPercent >= 50) triggers.push('bigDiscount');
  if (offer.coupon) triggers.push('hasCoupon');
  if (offer.highlight) triggers.push('hotItem');
  if (offer.price <= 50) triggers.push('cheap');
  if (offer.price >= 500) triggers.push('premium');
  return triggers;
}

/**
 * Retorna uma frase de hook adequada à oferta.
 * Mistura nicho + sub-nicho + gatilhos. Seeded pelo productId pra ser idempotente.
 */
export function pickHook(offer, nicheId = 'general') {
  const seed = (offer.productId ?? offer.title ?? '') + 'h';
  const triggers = detectTriggers(offer);
  const subNiche = detectSubNiche(offer.title);

  // Pool inicial: hooks do nicho
  const pool = [...(HOOKS[nicheId] ?? HOOKS.general)];

  // Adiciona hooks do sub-nicho (se houver) — peso 2x
  if (subNiche && SUB_NICHE_HOOKS[subNiche]) {
    pool.push(...SUB_NICHE_HOOKS[subNiche], ...SUB_NICHE_HOOKS[subNiche]);
  }

  // 30% de chance de usar um trigger hook se houver — gira o seed
  if (triggers.length > 0 && (strHash(seed + 't') % 10) < 3) {
    const trigger = triggers[strHash(seed + 'ti') % triggers.length];
    const triggerHooks = TRIGGER_HOOKS[trigger];
    if (triggerHooks?.length) return pickFrom(triggerHooks, seed);
  }

  return pickFrom(pool, seed);
}

export function pickCloser(offer, nicheId = 'general') {
  const seed = (offer.productId ?? offer.title ?? '') + 'c';
  const triggers = detectTriggers(offer);

  const pool = [...(CLOSERS[nicheId] ?? CLOSERS.general)];

  // 20% de chance de usar trigger closer se houver
  if (triggers.length > 0 && (strHash(seed + 't') % 10) < 2) {
    const trigger = triggers.find((t) => TRIGGER_CLOSERS[t]);
    if (trigger) return pickFrom(TRIGGER_CLOSERS[trigger], seed);
  }

  return pickFrom(pool, seed);
}

export function pickPriceOpener(offer) {
  return pickFrom(PRICE_OPENERS, (offer.productId ?? '') + 'po');
}
export function pickPriceNow(offer) {
  return pickFrom(PRICE_NOW, (offer.productId ?? '') + 'pn');
}

/**
 * Mapeia audience legado pra nicho — pra retro compatibilidade
 * quando o workspace não tem nichePreset mas tem só audience.
 */
export function audienceToNicheFallback(audience) {
  if (audience === 'female') return 'general'; // sem nicho específico
  if (audience === 'male') return 'general';
  return 'general';
}
