import { getCurrentInstance, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { Bounds, FlightSource } from '../data/FlightSource';
import { Fr24Error } from '../data/Fr24Source';
import { TrackStore, type Track } from '../tracks/TrackStore';
import { analyze, type Analysis } from '../detect/analyze';

export type ScannerStatus = 'idle' | 'running' | 'stopped-error';

type Options = {
  source: Ref<FlightSource>;
  getBounds: () => Bounds | null;
  intervalMs: Ref<number>;
  sensitivity: Ref<number>;
};

const MAX_BACKOFF_MS = 120_000;
const FATAL_STATUSES = new Set([401, 402, 403]);

/** Цикл: опрос источника → TrackStore → analyze → реактивный результат. */
export function useScanner(options: Options) {
  const store = new TrackStore();
  const analysis = shallowRef<Analysis | null>(null);
  const tracks = shallowRef<Track[]>([]);
  const error = ref<string | null>(null);
  const status = ref<ScannerStatus>('idle');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  function recompute(bounds: Bounds): void {
    tracks.value = store.tracks();
    analysis.value = analyze(tracks.value, bounds, { sensitivity: options.sensitivity.value });
  }

  function schedule(ms: number): void {
    if (status.value !== 'running') return;
    timer = setTimeout(() => void tick(), ms);
  }

  async function tick(): Promise<void> {
    const bounds = options.getBounds();
    if (!bounds) {
      schedule(options.intervalMs.value);
      return;
    }
    const now = Date.now();
    try {
      const positions = await options.source.value.fetchPositions(bounds, now);
      store.add(positions, now);
      failures = 0;
      error.value = null;
      recompute(bounds);
      schedule(options.intervalMs.value);
    } catch (e) {
      if (e instanceof Fr24Error && FATAL_STATUSES.has(e.status)) {
        status.value = 'stopped-error';
        error.value = `${e.status}: ${e.message}`;
        return;
      }
      failures++;
      error.value = e instanceof Error ? e.message : String(e);
      const base = options.intervalMs.value;
      const delay = failures >= 3 ? Math.min(base * 2 ** (failures - 2), MAX_BACKOFF_MS) : base;
      schedule(delay);
    }
  }

  function start(): void {
    if (status.value === 'running') return;
    status.value = 'running';
    failures = 0;
    error.value = null;
    void tick();
  }

  function stop(): void {
    status.value = 'idle';
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function reset(): void {
    store.clear();
    tracks.value = [];
    analysis.value = null;
  }

  watch(options.sensitivity, () => {
    const b = options.getBounds();
    if (b && tracks.value.length) recompute(b);
  });

  if (getCurrentInstance()) onUnmounted(stop);

  return { analysis, tracks, error, status, start, stop, reset, tick };
}
