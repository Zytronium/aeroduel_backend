// Gets the serverToken if running in Electron
export default async function getServerToken() {
    if (typeof window !== 'undefined' && (window as any).electron) {
        // We are in Electron
        return await (window as any).electron.getServerToken();
    }
    return null; // We are on an external device (mobile phone, browser, etc.)
}
