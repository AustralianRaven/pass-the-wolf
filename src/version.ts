declare const __BUILD__: string;

/**
 * This build's version (the git commit it was built from). Online players exchange it in the
 * lobby, so a browser still running an older, cached copy of the game is told to refresh
 * instead of quietly misbehaving.
 */
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
