<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
// Worker MapLibre 6 грузится отдельным модулем; без явного адреса Vite его не отдаёт, тайлы не разбираются и 'load' не приходит.
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import type { Bounds } from '../data/FlightSource';
import type { Track } from '../tracks/TrackStore';
import type { Analysis } from '../detect/analyze';
import { pointAhead } from '../geometry/project';
import { lettersToGeoJson, planesToGeoJson, tracksToGeoJson, wordsToGeoJson, type PlaneMarker } from './geojson';

const props = defineProps<{ analysis: Analysis | null; tracks: Track[]; selectedId: string | null }>();
const emit = defineEmits<{ bounds: [b: Bounds]; select: [id: string | null] }>();

const container = ref<HTMLDivElement | null>(null);
let map: MapLibreMap | null = null;
let ready = false;
let blinkTimer: ReturnType<typeof setInterval> | null = null;
let planesTimer: ReturnType<typeof setInterval> | null = null;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['tracks', 'planes', 'letter-strokes', 'letter-labels', 'word-outlines', 'word-labels'] as const;
// Шрифт, который отдаёт сервер стилей; без него MapLibre рисует каждый глиф локально и сыплет предупреждениями.
const TEXT_FONT = ['Noto Sans Regular'];
const PLANE_ICON_PX = 48;
const PLANE_COLOR = '#ffd600';
const PLANE_SELECTED_COLOR = '#ff5252';
const PLANES_TICK_MS = 100;        // как часто сдвигаем иконки между опросами
const MAX_EXTRAPOLATION_MS = 60_000; // борт без обновлений дальше не летит
const INITIAL_CENTER: [number, number] = [37.6, 55.7];
const INITIAL_ZOOM = 8;

const LETTER_COLOR = ['match', ['get', 'kind'], 'X', '#ff5252', 'U', '#ffb300', 'I', '#40c4ff', 'breve', '#40c4ff', '#ffffff'];
const GRADE_COLOR = ['match', ['get', 'grade'], 'perfect', '#ff1744', 'good', '#ff9100', 'crooked', '#b39ddb', '#9e9e9e'];

/** Силуэт самолёта носом на север. Рисуется на canvas, чтобы не грузить файл. */
function makePlaneIcon(px: number, fill: string): ImageData {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d')!;
  g.scale(px / 24, px / 24);
  g.translate(12, 12);
  g.fillStyle = fill;
  g.strokeStyle = '#3a3000';
  g.lineWidth = 0.8;
  g.beginPath();
  // фюзеляж, крылья, хвост — в координатах 24x24, нос вверх
  g.moveTo(0, -11); g.lineTo(1.6, -8); g.lineTo(1.6, -3);
  g.lineTo(11, 2); g.lineTo(11, 4); g.lineTo(1.6, 1.5);
  g.lineTo(1.6, 7); g.lineTo(4.5, 9.5); g.lineTo(4.5, 11); g.lineTo(0, 9.5);
  g.lineTo(-4.5, 11); g.lineTo(-4.5, 9.5); g.lineTo(-1.6, 7);
  g.lineTo(-1.6, 1.5); g.lineTo(-11, 4); g.lineTo(-11, 2); g.lineTo(-1.6, -3);
  g.lineTo(-1.6, -8); g.closePath();
  g.fill(); g.stroke();
  return g.getImageData(0, 0, px, px);
}

function currentBounds(): Bounds {
  const b = map!.getBounds();
  return { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() };
}

function setData(id: (typeof SOURCES)[number], data: FeatureCollection): void {
  const src = map?.getSource(id) as GeoJSONSource | undefined;
  src?.setData(data);
}

/** Иконки между опросами ползут по курсу от последней точки; не дольше MAX_EXTRAPOLATION_MS. */
function planeMarkers(): PlaneMarker[] {
  const now = Date.now();
  return props.tracks
    .filter((t) => t.points.length >= 1)
    .map((t) => {
      const last = t.points[t.points.length - 1];
      const hours = Math.min(Math.max(now - t.lastSeen, 0), MAX_EXTRAPOLATION_MS) / 3_600_000;
      const p = pointAhead(last, t.heading, t.speedKmh * hours);
      return { id: t.id, lat: p.lat, lon: p.lon, heading: t.heading, selected: t.id === props.selectedId };
    });
}

function renderPlanes(): void {
  if (!map || !ready) return;
  setData('planes', planesToGeoJson(planeMarkers()));
}

function render(): void {
  if (!map || !ready) return;
  setData('tracks', tracksToGeoJson(props.tracks));
  renderPlanes();
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
    layout: { 'text-field': ['get', 'label'], 'text-font': TEXT_FONT, 'text-size': 12, 'text-offset': [0, -1.2] },
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
    layout: { 'text-field': ['get', 'label'], 'text-font': TEXT_FONT, 'text-size': ['match', ['get', 'grade'], 'perfect', 28, 'good', 22, 16] as never, 'text-allow-overlap': true },
    paint: { 'text-color': GRADE_COLOR as never, 'text-halo-color': '#000000', 'text-halo-width': 2 } });

  // Самолёты — верхний слой, чтобы по ним можно было кликнуть.
  m.addImage('plane', makePlaneIcon(PLANE_ICON_PX, PLANE_COLOR), { pixelRatio: 2 });
  m.addImage('plane-selected', makePlaneIcon(PLANE_ICON_PX, PLANE_SELECTED_COLOR), { pixelRatio: 2 });
  m.addLayer({ id: 'planes', type: 'symbol', source: 'planes',
    layout: {
      'icon-image': ['case', ['get', 'selected'], 'plane-selected', 'plane'] as never,
      'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true,
    } });

  m.on('click', 'planes', (e) => {
    const id = e.features?.[0]?.properties?.id as string | undefined;
    emit('select', id ?? null);
  });
  m.on('click', (e: MapMouseEvent) => {
    if (m.queryRenderedFeatures(e.point, { layers: ['planes'] }).length === 0) emit('select', null);
  });
  m.on('mouseenter', 'planes', () => { m.getCanvas().style.cursor = 'pointer'; });
  m.on('mouseleave', 'planes', () => { m.getCanvas().style.cursor = ''; });

  let on = true;
  blinkTimer = setInterval(() => {
    on = !on;
    m.setPaintProperty('word-outlines-perfect', 'line-opacity', on ? 1 : 0.2);
  }, 500);
  planesTimer = setInterval(renderPlanes, PLANES_TICK_MS);
}

onMounted(() => {
  setWorkerUrl(mapWorkerUrl);
  map = new MapLibreMap({
    container: container.value!,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
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
  if (planesTimer) clearInterval(planesTimer);
  map?.remove();
  map = null;
});

watch(() => [props.analysis, props.tracks], render);
watch(() => props.selectedId, renderPlanes);

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
