<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
// Worker MapLibre 6 грузится отдельным модулем; без явного адреса Vite его не отдаёт, тайлы не разбираются и 'load' не приходит.
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import type { Bounds } from '../data/FlightSource';
import type { Track } from '../tracks/TrackStore';
import type { Analysis } from '../detect/analyze';
import { lettersToGeoJson, tracksToGeoJson, wordsToGeoJson } from './geojson';

const props = defineProps<{ analysis: Analysis | null; tracks: Track[] }>();
const emit = defineEmits<{ bounds: [b: Bounds] }>();

const container = ref<HTMLDivElement | null>(null);
let map: MapLibreMap | null = null;
let ready = false;
let blinkTimer: ReturnType<typeof setInterval> | null = null;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['tracks', 'letter-strokes', 'letter-labels', 'word-outlines', 'word-labels'] as const;

const LETTER_COLOR = ['match', ['get', 'kind'], 'X', '#ff5252', 'U', '#ffb300', 'I', '#40c4ff', 'breve', '#40c4ff', '#ffffff'];
const GRADE_COLOR = ['match', ['get', 'grade'], 'perfect', '#ff1744', 'good', '#ff9100', 'crooked', '#b39ddb', '#9e9e9e'];

function currentBounds(): Bounds {
  const b = map!.getBounds();
  return { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() };
}

function setData(id: (typeof SOURCES)[number], data: FeatureCollection): void {
  const src = map?.getSource(id) as GeoJSONSource | undefined;
  src?.setData(data);
}

function render(): void {
  if (!map || !ready) return;
  setData('tracks', tracksToGeoJson(props.tracks));
  const a = props.analysis;
  if (!a) {
    setData('letter-strokes', EMPTY); setData('letter-labels', EMPTY);
    setData('word-outlines', EMPTY); setData('word-labels', EMPTY);
    return;
  }
  const letters = lettersToGeoJson(a.letters, a.projection);
  const words = wordsToGeoJson(a.words, a.projection);
  setData('letter-strokes', letters.strokes);
  setData('letter-labels', letters.labels);
  setData('word-outlines', words.outlines);
  setData('word-labels', words.labels);
}

function addLayers(m: MapLibreMap): void {
  for (const id of SOURCES) m.addSource(id, { type: 'geojson', data: EMPTY });

  m.addLayer({ id: 'tracks', type: 'line', source: 'tracks',
    paint: { 'line-color': '#7a7a7a', 'line-width': 1, 'line-opacity': 0.7 } });

  m.addLayer({ id: 'letter-strokes', type: 'line', source: 'letter-strokes',
    paint: { 'line-color': LETTER_COLOR as never, 'line-width': 3 } });

  m.addLayer({ id: 'letter-labels', type: 'symbol', source: 'letter-labels',
    layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, -1.2] },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 } });

  // Слова: обычные, анаграммы пунктиром, эталонные мигают.
  m.addLayer({ id: 'word-outlines', type: 'line', source: 'word-outlines',
    filter: ['all', ['!=', ['get', 'grade'], 'anagram'], ['!=', ['get', 'grade'], 'perfect']],
    paint: { 'line-color': GRADE_COLOR as never, 'line-width': ['match', ['get', 'grade'], 'good', 3, 1.5] as never } });
  m.addLayer({ id: 'word-outlines-anagram', type: 'line', source: 'word-outlines',
    filter: ['==', ['get', 'grade'], 'anagram'],
    paint: { 'line-color': '#9e9e9e', 'line-width': 1.5, 'line-dasharray': [2, 2] } });
  m.addLayer({ id: 'word-outlines-perfect', type: 'line', source: 'word-outlines',
    filter: ['==', ['get', 'grade'], 'perfect'],
    paint: { 'line-color': '#ff1744', 'line-width': 5 } });

  m.addLayer({ id: 'word-labels', type: 'symbol', source: 'word-labels',
    layout: { 'text-field': ['get', 'label'], 'text-size': ['match', ['get', 'grade'], 'perfect', 28, 'good', 22, 16] as never, 'text-allow-overlap': true },
    paint: { 'text-color': GRADE_COLOR as never, 'text-halo-color': '#000000', 'text-halo-width': 2 } });

  let on = true;
  blinkTimer = setInterval(() => {
    on = !on;
    m.setPaintProperty('word-outlines-perfect', 'line-opacity', on ? 1 : 0.2);
  }, 500);
}

onMounted(() => {
  setWorkerUrl(mapWorkerUrl);
  map = new MapLibreMap({
    container: container.value!,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [37.6, 55.7],
    zoom: 6,
  });
  map.addControl(new NavigationControl(), 'top-right');
  map.on('load', () => {
    addLayers(map!);
    ready = true;
    render();
    emit('bounds', currentBounds());
  });
  map.on('moveend', () => emit('bounds', currentBounds()));
});

onBeforeUnmount(() => {
  if (blinkTimer) clearInterval(blinkTimer);
  map?.remove();
  map = null;
});

watch(() => [props.analysis, props.tracks], render);

defineExpose({
  flyTo(lon: number, lat: number) {
    map?.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 7) });
  },
});
</script>

<template>
  <div ref="container" class="map" />
</template>

<style scoped>
.map {
  position: absolute;
  inset: 0;
}
</style>
