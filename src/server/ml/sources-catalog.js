/**
 * Catálogo de fontes de scraping do ML.
 *
 * Tipos:
 *   - method: 'fetch'     → mercadolivre.com.br/ofertas?container_id=X (HTML estático, rápido)
 *   - method: 'playwright' → lista.mercadolivre.com.br/_Container_X
 *                            (ML redireciona pra /gz/account-verification em fetch puro,
 *                             precisa de browser real)
 *
 * Paginação:
 *   - fetch: ?page=N
 *   - playwright: o template da URL precisa ter "_PAGE_" como placeholder ou aceitar #page=N
 *
 * Validado empiricamente em 2026-05-20.
 */

export const SOURCE_CATALOG = [
  // ── BASE / OFERTAS GERAIS ──────────────────────────────────────────────────
  {
    id: 'ofertas-geral',
    label: 'Ofertas Gerais',
    url: 'https://www.mercadolivre.com.br/ofertas',
    method: 'fetch',
    pages: 20,
    category: 'general',
  },

  // ── CATEGORIAS BLOQUEADAS (precisam Playwright) ────────────────────────────
  {
    id: 'supermercado',
    label: 'Supermercado',
    url: 'https://lista.mercadolivre.com.br/supermercado/market/_Deal_cpg-melhores-ofertas_Container_cpg-melhores-ofertas',
    method: 'playwright',
    pages: 42,
    category: 'supermercado',
  },
  {
    id: 'moda-feminina',
    label: 'Moda Feminina',
    url: 'https://lista.mercadolivre.com.br/_Container_moda-fashion_FILTRABLE*GENDER_18549361',
    method: 'playwright',
    pages: 42,
    category: 'fashion-f',
  },
  {
    id: 'moda-masculina',
    label: 'Moda Masculina',
    url: 'https://lista.mercadolivre.com.br/_Container_moda-fashion_FILTRABLE*GENDER_18549360',
    method: 'playwright',
    pages: 42,
    category: 'fashion-m',
  },
  {
    id: 'moda-infantil',
    label: 'Moda Infantil & Bebê',
    url: 'https://lista.mercadolivre.com.br/_Container_modakidsbebe',
    method: 'playwright',
    pages: 42,
    category: 'babies',
  },
  {
    id: 'achadinhos-200',
    label: 'Achadinhos até R$200',
    url: 'https://lista.mercadolivre.com.br/_PriceRange_0BRL-200BRL_Container_achadinhos-brasil_NoIndex_True',
    method: 'playwright',
    pages: 42,
    category: 'general',
  },

  // ── CONTAINERS / FETCH ─────────────────────────────────────────────────────
  {
    id: 'relampago',
    label: 'Ofertas Relâmpago',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779362-1&promotion_type=lightning',
    method: 'fetch',
    pages: 4,
    category: 'general',
  },
  {
    id: 'imbativeis',
    label: 'Ofertas Imbatíveis',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB1298579-1&deal_ids=MLB1298579',
    method: 'fetch',
    pages: 20,
    category: 'general',
  },
  {
    id: 'outlet',
    label: 'Outlet',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB916440-2',
    method: 'fetch',
    pages: 20,
    category: 'general',
  },
  {
    id: 'celulares',
    label: 'Celulares',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779535-1&domain_id=MLB-CELLPHONES',
    method: 'fetch',
    pages: 20,
    category: 'cellphones',
  },
  {
    id: 'notebooks',
    label: 'Notebooks',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779536-1&domain_id=MLB-NOTEBOOKS',
    method: 'fetch',
    pages: 20,
    category: 'computing',
  },
  {
    id: 'menos-100',
    label: 'Menos de R$100',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779362-1&price=0.0-100.0',
    method: 'fetch',
    pages: 20,
    category: 'general',
  },
  {
    id: 'internacional',
    label: 'Internacional',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB1442406-1',
    method: 'fetch',
    pages: 17,
    category: 'general',
  },
  {
    id: 'tenis',
    label: 'Tênis',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779537-1&domain_id=MLB-SNEAKERS',
    method: 'fetch',
    pages: 20,
    category: 'fashion-m',
  },
  {
    id: 'fones',
    label: 'Fones',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779538-1&domain_id=MLB-HEADPHONES',
    method: 'fetch',
    pages: 20,
    category: 'tech',
  },
  {
    id: 'tvs',
    label: 'TVs',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779539-1&domain_id=MLB-TELEVISIONS',
    method: 'fetch',
    pages: 20,
    category: 'tech',
  },
  {
    id: 'ferramentas',
    label: 'Ferramentas',
    url: 'https://www.mercadolivre.com.br/ofertas?container_id=MLB779540-1&domain_id=MLB-WELDING_MACHINES$MLB-TOOLS$MLB-WELDING_BLOWTORCHES$MLB-WELDING_RODS$MLB-DRILLS_SCREWDRIVERS$MLB-ELECTRIC_DRILLS$MLB-DRILL_BITS$MLB-POWER_GRINDERS$MLB-COMBINED_TOOL_SETS$MLB-ELECTRIC_CIRCULAR_SAWS$MLB-TOOL_ACCESSORIES_AND_SPARES$MLB-WRENCHES$MLB-WRENCH_SETS',
    method: 'fetch',
    pages: 20,
    category: 'home',
  },
];

export function findSourceById(id) {
  return SOURCE_CATALOG.find((s) => s.id === id);
}

// 48 itens por página em listagens lista.mercadolivre.com.br (padrão ML)
const ITEMS_PER_LIST_PAGE = 48;

/**
 * Constrói a URL paginada de uma fonte. Formatos do ML:
 *
 *   mercadolivre.com.br/ofertas              → ?page=N
 *   mercadolivre.com.br/ofertas?container=X  → &page=N
 *   lista.mercadolivre.com.br/path           → /path_Desde_<offset+1>
 *   lista.mercadolivre.com.br/path_NoIndex_True
 *                                            → /path_Desde_<offset+1>_NoIndex_True
 *
 * Onde offset = (page-1) * 48 (cada página tem 48 itens).
 *
 * IMPORTANTE: o ML NÃO suporta ?page=N em /lista/... Tentar isso devolve
 * sempre a página 1, causando bug onde todas as 42 "páginas" trazem os
 * mesmos 41 produtos (descoberto via teste em prod 2026-05-20).
 */
export function buildPageUrl(source, page) {
  if (page <= 1) return source.url;

  const url = source.url;
  const isListing = url.includes('lista.mercadolivre.com.br/');
  const offset = (page - 1) * ITEMS_PER_LIST_PAGE + 1; // 1-based

  if (isListing) {
    // Insere _Desde_N antes de _NoIndex_True se existir, senão no fim do path
    // (mas antes de ? se houver query, e antes de # fragment)
    const [pathPart, queryPart] = url.split('?');
    let newPath;
    if (pathPart.includes('_NoIndex_True')) {
      newPath = pathPart.replace('_NoIndex_True', `_Desde_${offset}_NoIndex_True`);
    } else {
      newPath = `${pathPart}_Desde_${offset}`;
    }
    return queryPart ? `${newPath}?${queryPart}` : newPath;
  }

  // /ofertas e variantes — usa query
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}page=${page}`;
}
