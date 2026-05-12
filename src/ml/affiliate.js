/**
 * Anexa parâmetros de afiliado a uma URL de produto do Mercado Livre.
 *
 * Suporta dois formatos de tag (definidos em ML_AFFILIATE_TAG no .env):
 *  - Matt Tool (novo):  "matt:USERNAME:TOOLID"
 *      → adiciona ?matt_word=USERNAME&matt_tool=TOOLID
 *  - Tag simples (legado): "SEUNOME-20"
 *      → adiciona ?tag=SEUNOME-20
 *
 * Se a tag não estiver configurada, retorna a URL original sem modificar.
 */
export function attachAffiliateTag(productUrl, affiliateTag) {
  if (!affiliateTag) return productUrl;

  try {
    const url = new URL(productUrl);

    if (affiliateTag.startsWith('matt:')) {
      const [, mattWord, mattTool] = affiliateTag.split(':');
      if (mattWord && mattTool) {
        url.searchParams.set('matt_word', mattWord);
        url.searchParams.set('matt_tool', mattTool);
      }
    } else {
      url.searchParams.set('tag', affiliateTag);
    }

    return url.toString();
  } catch {
    return productUrl;
  }
}
