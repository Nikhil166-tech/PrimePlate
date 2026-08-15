// src/router.ts
export type RouteHandler = () => void;

interface RouteEntry {
  path: string;
  pattern: string; // e.g. "#/providers/" for dynamic params or "#/providers" for exact
  isDynamic: boolean;
  handler: RouteHandler;
}

const routes: RouteEntry[] = [];

export function registerRoute(path: string, handler: RouteHandler) {
  const colonIdx = path.indexOf(':');
  const isDynamic = colonIdx !== -1;
  const pattern = isDynamic ? path.substring(0, colonIdx) : path;
  routes.push({ path, pattern, isDynamic, handler });
}

export function navigate(path: string) {
  window.location.hash = path;
}

function onHashChange() {
  const fullHash = window.location.hash || '#/home';
  const cleanHash = fullHash.split('?')[0];
  const parts = cleanHash.split('#').filter(Boolean);
  const routeCandidate = parts.length > 0 && parts[0].startsWith('/') ? '#' + parts[0] : '#/home';

  // 1. Exact match first
  const exact = routes.find((r) => !r.isDynamic && r.pattern === routeCandidate);
  if (exact) {
    exact.handler();
    return;
  }

  // 2. Dynamic route match (e.g. #/providers/:id or #/checkout/:planId)
  const dynamic = routes.find((r) => r.isDynamic && routeCandidate.startsWith(r.pattern));
  if (dynamic) {
    dynamic.handler();
    return;
  }

  // 3. Fallback to home route
  const defaultRoute = routes.find((r) => r.pattern === '#/home');
  defaultRoute?.handler();
}

export function initRouter() {
  window.addEventListener('hashchange', onHashChange);
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    window.location.hash = '#/home';
  } else {
    onHashChange();
  }
}
