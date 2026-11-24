// Listeners run in their own task so slow consumers (audio, DOM) never block
// the producer that is ingesting wireless observations.
const defaultSchedule = (fn) => setTimeout(fn, 0);

export function createEventBus({ schedule = defaultSchedule } = {}) {
  const listeners = new Map();

  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },

    emit(type, payload) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of [...set]) {
        schedule(() => {
          try {
            fn(payload);
          } catch (err) {
            console.error(`[SAWN] listener for "${type}" failed`, err);
          }
        });
      }
    },
  };
}
