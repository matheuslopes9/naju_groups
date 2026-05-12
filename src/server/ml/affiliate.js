/**
 * Anexa tag de afiliado a uma URL de produto ML.
 * Formatos suportados:
 *   - "matt:USERNAME:TOOLID" → ?matt_word=USERNAME&matt_tool=TOOLID
 *   - "SEUNOME"              → ?tag=SEUNOME
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
