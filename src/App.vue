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

const apiKey = (import.meta.env.VITE_FR24_KEY as string | undefined) ?? '';
const hasKey = apiKey.length > 0;

const mock = new MockSource(Date.now() % 100_000, 60);
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
</script>

<template>
  <div class="app">
    <MapView ref="mapView" :analysis="scanner.analysis.value" :tracks="scanner.tracks.value" :selected-id="null" @bounds="onBounds" />
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
      <Findings :words="words" :letters="letters" @select="selectWord" />
    </aside>
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
