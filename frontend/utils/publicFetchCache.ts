/**
 * Mode de cache des fetch de `public/data`.
 * `/data/game/<patch>/…` : le chemin change à chaque patch et le serveur répond `immutable`
 * → cache navigateur normal (pas d'aller-retour 304). Le reste peut changer sans changer d'URL.
 */
const VERSIONED_GAME_DATA = /^\/data\/game\/\d+\.\d+(\.\d+)?\//

export function publicFetchCache(path: string): RequestCache {
  return VERSIONED_GAME_DATA.test(path) ? 'default' : 'no-cache'
}
