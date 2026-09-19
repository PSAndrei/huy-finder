<script setup lang="ts">
import { computed } from 'vue';
import { GRADE_LABEL, LETTER_CHAR, type Letter, type LetterKind, type Word } from '../detect/types';

const props = defineProps<{ words: Word[]; letters: Letter[] }>();
const emit = defineEmits<{ select: [word: Word] }>();

const best = computed(() => props.words[0] ?? null);
const counts = computed(() => {
  const c: Record<LetterKind, number> = { X: 0, U: 0, I: 0 };
  for (const l of props.letters) c[l.kind]++;
  return c;
});
</script>

<template>
  <section class="findings">
    <h2>Находки</h2>

    <div v-if="best" class="best" :class="best.grade" @click="emit('select', best)">
      <div class="text">{{ best.text }}</div>
      <div class="bar"><div class="fill" :style="{ width: best.score + '%' }" /></div>
      <div class="meta">{{ best.score }}% · {{ GRADE_LABEL[best.grade] }}</div>
    </div>
    <p v-else class="empty">Слов пока нет. Ждём, пока самолёты долетят.</p>

    <ul v-if="words.length > 1" class="list">
      <li v-for="w in words.slice(1)" :key="w.key" :class="w.grade" @click="emit('select', w)">
        <span class="text">{{ w.text }}</span>
        <span class="bar"><span class="fill" :style="{ width: w.score + '%' }" /></span>
        <span class="meta">{{ w.score }}%</span>
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
.best .text { font-size: 28px; font-weight: bold; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.list li { display: grid; grid-template-columns: 3em 1fr 3em; gap: 6px; align-items: center; cursor: pointer; font-size: 13px; }
.bar { display: block; height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
.fill { display: block; height: 100%; background: currentColor; }
.perfect { color: #ff1744; }
.good { color: #ff9100; }
.crooked { color: #b39ddb; }
.anagram { color: #9e9e9e; }
.meta, .empty, .counts { font-size: 13px; color: #bbb; }
.counts { display: flex; gap: 12px; }
</style>
