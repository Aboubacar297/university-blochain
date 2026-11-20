import { useEffect } from 'react';
import { config } from '../config';
import { useI18n } from '../i18n';

interface SeoOptions {
  title: string;
  description: string;
  path: string;
  /** Pages privées et liens de partage : ne pas indexer. */
  noindex?: boolean;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Titre, description, Open Graph, Twitter Card, canonique et directive robots propres à chaque page. */
export function useSeo({ title, description, path, noindex = false }: SeoOptions) {
  const { lang } = useI18n();
  useEffect(() => {
    const fullTitle = title ? `${title} | ${config.siteName}` : config.siteName;
    const url = `${config.siteUrl}${path}`;
    const image = `${config.siteUrl}/og-image.png`;
    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', config.siteName);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', config.siteName);
    setMeta('property', 'og:locale', lang === 'fr' ? 'fr_FR' : 'en_GB');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setLink('canonical', url);
  }, [title, description, path, noindex, lang]);
}
