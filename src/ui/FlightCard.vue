<script setup lang="ts">
import type { Track } from '../tracks/TrackStore';
import type { Photo } from '../data/photos';
import type { FlightStats } from '../detect/flightStats';
import { GRADE_LABEL, LETTER_CHAR } from '../detect/types';

const props = defineProps<{ track: Track; photos: Photo[]; stats: FlightStats }>();
const emit = defineEmits<{ close: [] }>();

const NONE = '—';
</script>

<template>
  <section class="card">
    <header class="head">
      <div>
        <div class="callsign">
          {{ props.track.info?.callsign ?? props.track.id }}
          <span class="chip">{{ props.track.info?.aircraft ?? NONE }}</span>
        </div>
        <div class="airline">{{ props.track.info?.airline ?? 'Неизвестная авиакомпания' }}</div>
      </div>
      <button class="close" title="Закрыть" @click="emit('close')">×</button>
    </header>

    <div class="photos">
      <figure v-for="p in props.photos" :key="p.url">
        <img :src="p.url" alt="" />
        <figcaption v-if="p.author">© {{ p.author }}</figcaption>
      </figure>
      <div v-if="props.photos.length === 0" class="nophoto">фото не нашлось</div>
    </div>

    <div class="route">
      <div class="airport">
        <div class="iata">{{ props.track.info?.from.iata ?? NONE }}</div>
        <div class="city">{{ props.track.info?.from.city }}</div>
      </div>
      <div class="arrow">✈</div>
      <div class="airport">
        <div class="iata">{{ props.track.info?.to.iata ?? NONE }}</div>
        <div class="city">{{ props.track.info?.to.city }}</div>
      </div>
    </div>

    <div class="stats">
      <div class="title">Хуёвость <b>{{ props.stats.score }}%</b></div>
      <div class="bar"><div class="fill" :style="{ width: props.stats.score + '%' }" /></div>
      <ul v-if="props.stats.letters.length || props.stats.words.length">
        <li v-for="(l, i) in props.stats.letters" :key="'l' + i">Нарисовал букву {{ LETTER_CHAR[l.kind] }} на {{ l.score }}%</li>
        <li v-for="(w, i) in props.stats.words" :key="'w' + i" :class="w.grade">В составе слова {{ w.text }}, {{ GRADE_LABEL[w.grade] }}, {{ w.score }}%</li>
      </ul>
      <p v-else class="none">Ничего не нарисовал</p>
    </div>
  </section>
</template>

<style scoped>
.card {
  position: absolute; top: 12px; right: 12px; width: 340px; max-height: calc(100% - 24px); overflow: auto;
  background: rgba(20, 20, 20, 0.95); color: #eee; border-radius: 8px; display: flex; flex-direction: column;
}
.head { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px; }
.callsign { font-size: 26px; font-weight: bold; color: #ffd600; display: flex; align-items: center; gap: 8px; }
.chip { font-size: 12px; font-weight: normal; color: #fff; background: #2a5d8f; border-radius: 4px; padding: 2px 6px; }
.airline { font-size: 14px; color: #ddd; }
.close { background: none; border: none; color: #eee; font-size: 26px; line-height: 1; cursor: pointer; }
.photos { display: flex; gap: 2px; background: #000; min-height: 120px; }
.photos figure { margin: 0; flex: 1; position: relative; }
.photos img { width: 100%; height: 160px; object-fit: cover; display: block; }
.photos figcaption { position: absolute; left: 6px; bottom: 4px; font-size: 11px; color: #ddd; text-shadow: 0 0 3px #000; }
.nophoto { flex: 1; display: flex; align-items: center; justify-content: center; color: #777; font-size: 13px; }
.route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 12px; text-align: center; }
.iata { font-size: 36px; font-weight: bold; }
.city { font-size: 13px; color: #bbb; text-transform: uppercase; }
.arrow { font-size: 24px; color: #ffd600; }
.stats { padding: 12px; border-top: 1px solid #333; font-size: 13px; }
.title { font-size: 15px; margin-bottom: 6px; }
.bar { height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.fill { height: 100%; background: #ffd600; }
ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.none { color: #999; margin: 0; }
.perfect { color: #ff1744; }
.good { color: #ff9100; }
.crooked { color: #b39ddb; }
.anagram { color: #9e9e9e; }
</style>
