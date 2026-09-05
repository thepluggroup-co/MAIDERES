// Mode aperçu — bypass du login + données mockées, actif uniquement en dev
// (import.meta.env.DEV), jamais dans un build de production.
// Désactivable localement en développement normal avec un .env.local :
//   VITE_DISABLE_PREVIEW=true
export const PREVIEW_MODE = import.meta.env.DEV && import.meta.env.VITE_DISABLE_PREVIEW !== 'true'
