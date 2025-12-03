// Gets the serverToken if running in Electron
export default async function getServerToken() {
  if (typeof window !== 'undefined' && (window as any).electron) {
    // We are in Electron
    if ((window as any).electron.isDev()) {
      // in dev mode (from `npm run dev`), the server token is always undefined.
      // This is a bug, but as it only occurs in dev mode, is not a security risk,
      // and therefore will not be fixed.
      return undefined;
    }
    return await (window as any).electron.getServerToken();
  }
  return undefined; // We are on an external device (mobile phone, browser, etc.) or in dev mode
}
