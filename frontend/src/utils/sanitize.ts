export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getSafeImageUrl(url: string | null | undefined): string {
  const fallback = 'https://images.pexels.com/photos/5775684/pexels-photo-5775684.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  return fallback;
}
