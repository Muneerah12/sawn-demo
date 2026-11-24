const STORAGE_KEY = 'sawn.airspace.audioPrefs.v1';

/** Session-scoped preferences (survive a refresh of the tab, cleared when the session ends). */
export function createSessionPrefs(storage = globalThis.sessionStorage) {
  if (!storage) return createMemoryPrefs();
  return {
    load() {
      try {
        return JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') ?? {};
      } catch {
        return {};
      }
    },
    save(patch) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ ...this.load(), ...patch }));
      } catch {
        // Storage may be unavailable (private mode / quota); preferences then last for this page only.
      }
    },
  };
}

export function createMemoryPrefs(initial = {}) {
  let data = { ...initial };
  return {
    load: () => ({ ...data }),
    save(patch) {
      data = { ...data, ...patch };
    },
  };
}
