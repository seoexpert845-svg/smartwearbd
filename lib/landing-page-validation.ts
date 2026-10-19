const sectionTypes = ['hero', 'features', 'gallery', 'feature-list', 'text'];
const fonts = ['Hind Siliguri', 'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali'];
const safeHref = (value: string) => !value || value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') || /^https?:\/\//i.test(value) || value.startsWith('#');
const validMedia = (value: string) => !value || /^\/uploads\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|gif)$/i.test(value) || /^\/api\/uploads\/[a-f0-9]{24}$/i.test(value) || /^https?:\/\//i.test(value);

export function validatePage(body: Record<string, unknown>) {
  const sections = Array.isArray(body.sections) ? body.sections : [];
  const featuredProducts = Array.isArray(body.featuredProducts) ? body.featuredProducts : [];
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160
    || typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)
    || !['published', 'draft', 'demo'].includes(String(body.status))
    || !['standard', 'minimal', 'campaign'].includes(String(body.headerTemplate))
    || !fonts.includes(String(body.fontFamily))
    || typeof body.primaryColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.primaryColor)
    || String(body.metaTitle || '').length > 160 || String(body.metaDescription || '').length > 320 || String(body.metaKeywords || '').length > 500
    || sections.length > 40 || featuredProducts.length > 100
    || sections.some((section) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) return true;
      const item = section as Record<string, unknown>;
      return !sectionTypes.includes(String(item.type))
        || !['centered', 'split'].includes(String(item.layout))
        || ['title', 'subtitle', 'mediaUrl', 'buttonText', 'buttonUrl', 'content'].some((key) => typeof (item[key] ?? '') !== 'string')
        || String(item.title || '').length > 240 || String(item.subtitle || '').length > 2000
        || String(item.content || '').length > 10000 || String(item.buttonText || '').length > 80
        || String(item.mediaUrl || '').length > 2048 || String(item.buttonUrl || '').length > 2048
        || !validMedia(String(item.mediaUrl || '')) || !safeHref(String(item.buttonUrl || ''))
        || item.images !== undefined && (!Array.isArray(item.images) || item.images.length > 20 || item.images.some((image) => typeof image !== 'string' || image.length > 2048 || !validMedia(image)));
    })
    || featuredProducts.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
    return 'Landing page fields are invalid. Check the title, slug, sections, SEO, links and theme settings.';
  }
  return '';
}
