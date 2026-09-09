// src/router.ts
export type RouteHandler = () => void;

interface RouteEntry {
  path: string;
  pattern: string;
  isDynamic: boolean;
  handler: RouteHandler;
}

const routes: RouteEntry[] = [];

/**
 * Normalizes any route string into a canonical clean path (e.g. "#/home" -> "/home", "home" -> "/home").
 */
export function normalizePath(path: string): string {
  if (!path) return '/home';
  let clean = path.trim();
  if (clean.startsWith('#')) {
    clean = clean.substring(1);
  }
  const qIdx = clean.indexOf('?');
  const pathOnly = qIdx !== -1 ? clean.substring(0, qIdx) : clean;
  if (!pathOnly.startsWith('/')) {
    return '/' + pathOnly;
  }
  return pathOnly === '/' ? '/home' : pathOnly;
}

/**
 * Returns current clean pathname (e.g. "/student/dashboard", "/providers/123").
 * Automatically handles legacy hash migrations if a user arrives with "#/something".
 */
export function getCurrentPath(): string {
  // If arrived with legacy hash like "#/providers" or "#/student/dashboard"
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const legacyPath = window.location.hash.substring(1);
    const [pathPart, queryPart] = legacyPath.split('?');
    const newUrl =
      pathPart +
      (queryPart ? '?' + queryPart : '') +
      (window.location.search && !queryPart ? window.location.search : '');
    window.history.replaceState({}, '', newUrl);
    return normalizePath(pathPart);
  }

  const pathname = window.location.pathname;
  if (!pathname || pathname === '/') {
    return '/home';
  }
  return normalizePath(pathname);
}

/**
 * Returns array of non-empty path segments (e.g. "/providers/abc" -> ["providers", "abc"]).
 */
export function getPathSegments(): string[] {
  const current = getCurrentPath();
  return current.split('/').filter(Boolean);
}

/**
 * Register a route with an exact path (e.g. "/home") or dynamic pattern (e.g. "/providers/:id").
 * Supports both clean paths and legacy hash syntax seamlessly.
 */
export function registerRoute(path: string, handler: RouteHandler) {
  const normalized = normalizePath(path);
  const colonIdx = normalized.indexOf(':');
  const isDynamic = colonIdx !== -1;
  const pattern = isDynamic ? normalized.substring(0, colonIdx) : normalized;
  routes.push({ path: normalized, pattern, isDynamic, handler });
}

/**
 * Client-side SPA navigation without full page reload.
 */
export function navigate(targetPath: string) {
  let clean = targetPath.trim();
  let anchor = '';

  // Handle pure in-page anchors on the current page (e.g. "#why-primeplate")
  if (clean.startsWith('#') && !clean.startsWith('#/')) {
    const elem = document.querySelector(clean);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  if (clean.includes('#')) {
    const hashIdx = clean.indexOf('#');
    if (!clean.substring(hashIdx).startsWith('#/')) {
      anchor = clean.substring(hashIdx);
      clean = clean.substring(0, hashIdx);
    } else {
      clean = clean.substring(hashIdx + 1);
    }
  }

  // Preserve query string if present
  let query = '';
  if (clean.includes('?')) {
    const qIdx = clean.indexOf('?');
    query = clean.substring(qIdx);
    clean = clean.substring(0, qIdx);
  }

  const normalized = normalizePath(clean);
  const fullTargetUrl = normalized + query + anchor;

  const currentFullUrl =
    window.location.pathname + window.location.search + window.location.hash;
  if (currentFullUrl !== fullTargetUrl) {
    window.history.pushState({}, '', fullTargetUrl);
  }

  onRouteChange(anchor);
}

function onRouteChange(targetAnchor?: string) {
  const currentPath = getCurrentPath();

  // Scroll restoration: scroll to top unless in-page anchor exists
  const anchor = targetAnchor || window.location.hash;
  if (anchor && (anchor.includes('why-primeplate') || anchor.includes('faq'))) {
    setTimeout(() => {
      const elem = document.querySelector(anchor);
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  // 1. Exact match first
  const exact = routes.find((r) => !r.isDynamic && r.pattern === currentPath);
  if (exact) {
    exact.handler();
    return;
  }

  // 2. Dynamic route match (e.g. /providers/:id or /checkout/:planId)
  const dynamic = routes.find(
    (r) => r.isDynamic && currentPath.startsWith(r.pattern),
  );
  if (dynamic) {
    dynamic.handler();
    return;
  }

  // 3. Fallback to /home
  const defaultRoute = routes.find((r) => r.pattern === '/home');
  defaultRoute?.handler();
}

/**
 * Initializes HTML5 History routing, listens to browser Back/Forward (popstate),
 * and intercepts internal link clicks for instant SPA transitions.
 */
export function initRouter() {
  // Listen to browser Back / Forward buttons
  window.addEventListener('popstate', () => {
    onRouteChange();
  });

  // Intercept all clicks on internal <a> links to prevent full browser reloads
  document.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href) return;

    // Ignore external URLs, data URLs, blob URLs, download links, telephone, mailto, or new tabs
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('data:') ||
      href.startsWith('blob:') ||
      target.hasAttribute('download') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      target.getAttribute('target') === '_blank'
    ) {
      return;
    }

    // In-page hash anchors on same page like #why-primeplate, #faq, #footer
    if (href.startsWith('#') && !href.startsWith('#/')) {
      const elem = document.querySelector(href);
      if (elem) {
        e.preventDefault();
        elem.scrollIntoView({ behavior: 'smooth' });
        window.history.replaceState(
          {},
          '',
          window.location.pathname + window.location.search + href,
        );
      }
      return;
    }

    // Internal SPA route
    e.preventDefault();
    navigate(href);
  });

  // Handle initial page load (migrates legacy hashes if present)
  getCurrentPath();
  if (window.location.pathname === '/' || window.location.pathname === '') {
    window.history.replaceState({}, '', '/home');
  }
  onRouteChange();
}
