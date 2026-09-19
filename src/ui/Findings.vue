<script setup lang="ts">
import { computed } from 'vue';
import { GRADE_LABEL, LETTER_CHAR, type Letter, type LetterKind, type Word } from '../detect/types';
import { sameIds, wordTrackIds } from '../detect/focus';

const props = defineProps<{ words: Word[]; letters: Letter[]; focusIds: Set<string> | null }>();
const emit = defineEmits<{ select: [word: Word]; focus: [word: Word | null] }>();

const best = computed(() => props.words[0] ?? null);

/** Слово в фокусе, если набор его бортов совпадает с фильтром. */
function isFocused(w: Word): boolean {
  return sameIds(wordTrackIds(w), props.focusIds);
}
const counts = computed(() => {
  const c: Record<LetterKind, number> = { X: 0, U: 0, I: 0 };
  for (const l of props.letters) c[l.kind]++;
  return c;
});
</script>

<template>
  <section class="findings">
    <h2>Находки</h2>

    <button v-if="focusIds" class="show-all" @click="emit('focus', null)">Показать все</button>

    <div v-if="best" class="best" :class="best.grade" @click="emit('select', best)">
      <div class="text">
        {{ best.text }}
        <button class="only" :class="{ on: isFocused(best) }" title="Показать только его" @click.stop="emit('focus', best)">◎</button>
      </div>
      <div class="bar"><div class="fill" :style="{ width: best.score + '%' }" /></div>
      <div class="meta">{{ best.score }}% · {{ GRADE_LABEL[best.grade] }}</div>
    </div>
    <p v-else class="empty">Слов пока нет. Ждём, пока самолёты долетят.</p>

    <ul v-if="words.length > 1" class="list">
      <li v-for="w in words.slice(1)" :key="w.key" :class="w.grade" @click="emit('select', w)">
        <span class="text">{{ w.text }}</span>
        <span class="bar"><span class="fill" :style="{ width: w.score + '%' }" /></span>
        <span class="meta">{{ w.score }}%</span>
        <button class="only" :class="{ on: isFocused(w) }" title="Показать только его" @click.stop="emit('focus', w)">◎</button>
      </li>
    </ul>

    <p class="counts">
      <span v-for="kind in (['X', 'U', 'I'] as LetterKind[])" :key="kind">{{ LETTER_CHAR[kind] }} — {{ counts[kind] }}</span>
    </p>
  </section>
</template>

<style scoped>
.findings { display: flex; flex-direction: column; gap: 8px; }
.best { cursor: pointer; padding: 8px; border: 1px solid #444; border-radius: 6px; }
.best .text { font-size: 28px; font-weight: bold; display: flex; align-items: center; justify-content: space-between; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.list li { display: grid; grid-template-columns: 3em 1fr 3em auto; gap: 6px; align-items: center; cursor: pointer; font-size: 13px; }
.only { background: none; border: 1px solid #555; border-radius: 4px; color: #bbb; font-size: 14px; line-height: 1; padding: 2px 6px; cursor: pointer; }
.only.on { background: #ffd600; border-color: #ffd600; color: #111; }
.show-all { align-self: flex-start; background: #333; border: none; border-radius: 4px; color: #eee; padding: 4px 10px; cursor: pointer; }
.bar { display: block; height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
.fill { display: block; height: 100%; background: currentColor; }
.perfect { color: #ff1744; }
.good { color: #ff9100; }
.crooked { color: #b39ddb; }
.anagram { color: #9e9e9e; }
.meta, .empty, .counts { font-size: 13px; color: #bbb; }
.counts { display: flex; gap: 12px; }
</style>
