<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import MapView from './map/MapView.vue';
import Controls from './ui/Controls.vue';
import Findings from './ui/Findings.vue';
import { MockSource } from './data/MockSource';
import { Fr24Source } from './data/Fr24Source';
import type { Bounds, FlightSource } from './data/FlightSource';
import type { LetterKind, Word } from './detect/types';
import { useScanner } from './composables/useScanner';
import FlightCard from './ui/FlightCard.vue';
import { fetchAircraftPhotos, type Photo } from './data/photos';
import { flightStats } from './detect/flightStats';
import { filterAnalysis, sameIds, wordTrackIds } from './detect/focus';

const apiKey = (import.meta.env.VITE_FR24_KEY as string | undefined) ?? '';
const hasKey = apiKey.length > 0;

const mock = new MockSource(Date.now() % 100_000);
const api: FlightSource | null = hasKey ? new Fr24Source(apiKey) : null;

const mode = ref<'mock' | 'api'>('mock');
const intervalMs = ref(5000);
const sensitivity = ref(0);
const bounds = ref<Bounds | null>(null);
const mapView = ref<InstanceType<typeof MapView> | null>(null);

const source = computed<FlightSource>(() => (mode.value === 'api' && api ? api : mock));

const scanner = useScanner({
  source,
  getBounds: () => bounds.value,
  intervalMs,
  sensitivity,
});

watch(mode, (m) => {
  scanner.stop();
  scanner.reset();
  intervalMs.value = m === 'api' ? 20_000 : 5000;
  scanner.start();
});

function onBounds(b: Bounds): void {
  const first = bounds.value === null;
  bounds.value = b;
  if (first) scanner.start();
}

function plantLetter(kind: LetterKind): void {
  mock.plantLetter(kind);
}

function plantWord(): void {
  mock.plantWord();
}

function gotoDemo(): void {
  mode.value = 'mock';
}

function selectWord(w: Word): void {
  const a = scanner.analysis.value;
  if (!a) return;
  const ll = a.projection.toLatLon(w.center);
  mapView.value?.flyTo(ll.lon, ll.lat);
}

const words = computed(() => scanner.analysis.value?.words ?? []);
const letters = computed(() => scanner.analysis.value?.letters ?? []);

// Режим «только это слово»: на карте остаются борта слова и то, что они нарисовали.
const focusIds = ref<Set<string> | null>(null);
const visibleTracks = computed(() => {
  const ids = focusIds.value;
  return ids ? scanner.tracks.value.filter((t) => ids.has(t.id)) : scanner.tracks.value;
});
const visibleAnalysis = computed(() => {
  const a = scanner.analysis.value;
  return a && focusIds.value ? filterAnalysis(a, focusIds.value) : a;
});

function toggleFocus(w: Word | null): void {
  if (!w) { focusIds.value = null; return; }
  const ids = wordTrackIds(w);
  const same = sameIds(ids, focusIds.value);
  focusIds.value = same ? null : ids;
  if (!same) {
    selectWord(w);
    if (selectedId.value && !ids.has(selectedId.value)) selectedId.value = null;
  }
}

// Все борта слова исчезли — фильтр снимается сам.
watch(visibleTracks, (t) => {
  if (focusIds.value && t.length === 0) focusIds.value = null;
});

// Выбранный самолёт: карточка, фото, статистика.
const selectedId = ref<string | null>(null);
const selectedTrack = computed(() => scanner.tracks.value.find((t) => t.id === selectedId.value) ?? null);
const photos = ref<Photo[]>([]);
const stats = computed(() => flightStats(scanner.analysis.value, selectedId.value ?? ''));

watch(selectedId, async (id) => {
  photos.value = [];
  const info = id ? scanner.tracks.value.find((t) => t.id === id)?.info : null;
  if (!info) return;
  const found = await fetchAircraftPhotos(info);
  if (selectedId.value === id) photos.value = found;
});

// Борт исчез из хранилища — карточка закрывается.
watch(selectedTrack, (t) => {
  if (!t && selectedId.value !== null) selectedId.value = null;
});
</script>

<template>
  <div class="app">
    <MapView
      ref="mapView"
      :analysis="visibleAnalysis"
      :tracks="visibleTracks"
      :selected-id="selectedId"
      @bounds="onBounds"
      @select="selectedId = $event"
    />
    <aside class="panel">
      <Controls
        v-model:mode="mode"
        v-model:interval-ms="intervalMs"
        v-model:sensitivity="sensitivity"
        :has-key="hasKey"
        :status="scanner.status.value"
        :error="scanner.error.value"
        @plant-letter="plantLetter"
        @plant-word="plantWord"
        @start="scanner.start"
        @stop="scanner.stop"
        @goto-demo="gotoDemo"
      />
      <Findings :words="words" :letters="letters" :focus-ids="focusIds" @select="selectWord" @focus="toggleFocus" />
    </aside>
    <FlightCard v-if="selectedTrack" :track="selectedTrack" :photos="photos" :stats="stats" @close="selectedId = null" />
  </div>
</template>

<style>
html, body, #app { margin: 0; height: 100%; background: #111; color: #eee; font-family: system-ui, sans-serif; }
</style>

<style scoped>
.app { position: relative; height: 100%; }
.panel {
  position: absolute; top: 12px; left: 12px; width: 280px; max-height: calc(100% - 24px); overflow: auto;
  padding: 12px; background: rgba(20, 20, 20, 0.9); border-radius: 8px; display: flex; flex-direction: column; gap: 16px;
}
</style>
