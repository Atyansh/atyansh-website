// Minimal typed pub/sub. Game systems talk through this instead of holding
// references to each other (progress listens for "visited", audio listens for
// "footstep", UI listens for "toast", ...).

type Handler<T> = (payload: T) => void;

export class Emitter<M extends Record<string, unknown>> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(type: K, fn: Handler<M[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    this.handlers.get(type)?.forEach((fn) => (fn as Handler<M[K]>)(payload));
  }
}

/** Surface types drive footstep audio and particles */
export type Surface = 'asphalt' | 'concrete' | 'wood' | 'carpet' | 'grass' | 'gravel' | 'pad' | 'tile' | 'metal';

export type GameEvents = {
  toast: { title: string; body?: string; icon?: string; kind?: 'goal' | 'collect' | 'info' | 'reward' };
  footstep: { surface: Surface; intensity: number };
  land: { surface: Surface; impact: number };
  jump: Record<string, never>;
  levelEnter: { id: string };
  levelExit: { id: string };
  interact: { id: string };
  sfx: { name: string; volume?: number; pitch?: number };
  progress: { key: string };
  petted: { pet: string };
  collectible: { id: string };
};
