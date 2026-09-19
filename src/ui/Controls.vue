<script setup lang="ts">
import { ref, watch } from 'vue';
import type { LetterKind } from '../detect/types';
import type { ScannerStatus } from '../composables/useScanner';
import type { KeyStatus } from '../data/fr24Key';

const mode = defineModel<'mock' | 'api'>('mode', { required: true });
const intervalMs = defineModel<number>('intervalMs', { required: true });
const sensitivity = defineModel<number>('sensitivity', { required: true });

const props = defineProps<{
  hasKey: boolean; status: ScannerStatus; error: string | null;
  keyStatus: KeyStatus; keyMessage: string | null; keyTail: string;
}>();
const emit = defineEmits<{
  plantLetter: [kind: LetterKind];
  plantWord: [];
  start: [];
  stop: [];
  gotoDemo: [];
  saveKey: [key: string];
  removeKey: [];
}>();

const showKeyForm = ref(false);
const keyDraft = ref('');

// Ключ принят — форма сворачивается и очищается.
watch(() => props.keyStatus, (s) => {
  if (s === 'ok') { showKeyForm.value = false; keyDraft.value = ''; }
});
</script>

<template>
  <section class="controls">
    <h1>Huy Finder</h1>

    <label>
      Источник
      <select v-model="mode">
        <option value="mock">Демо (генератор)</option>
        <option value="api" :disabled="!hasKey">{{ hasKey ? 'Flightradar24 API' : 'Flightradar24 API — нет ключа' }}</option>
      </select>
    </label>

    <div class="key">
      <div v-if="keyStatus === 'ok'" class="row">
        <span>Ключ Flightradar24: ••••{{ keyTail }}</span>
        <button @click="emit('removeKey')">Удалить</button>
      </div>
      <button v-else-if="!showKeyForm" :disabled="keyStatus === 'checking'" @click="showKeyForm = true">
        {{ keyStatus === 'checking' ? 'Проверяю ключ…' : 'Добавить ключ Flightradar24' }}
      </button>
      <form v-else class="row" @submit.prevent="emit('saveKey', keyDraft.trim())">
        <input v-model="keyDraft" type="password" placeholder="ключ API" autocomplete="off" :disabled="keyStatus === 'checking'" />
        <button type="submit" :disabled="keyStatus === 'checking' || !keyDraft.trim()">
          {{ keyStatus === 'checking' ? 'Проверяю…' : 'Проверить и сохранить' }}
        </button>
      </form>
      <p v-if="keyMessage" class="error">{{ keyMessage }}</p>
    </div>

    <label>
      Опрос каждые {{ Math.round(intervalMs / 1000) }} с
      <input v-model.number="intervalMs" type="range" min="2000" max="60000" step="1000" />
    </label>

    <label>
      Чувствительность {{ sensitivity.toFixed(1) }}
      <input v-model.number="sensitivity" type="range" min="-1" max="1" step="0.1" />
    </label>

    <div class="row">
      <button v-if="status !== 'running'" @click="emit('start')">Старт</button>
      <button v-else @click="emit('stop')">Стоп</button>
    </div>

    <div v-if="mode === 'mock'" class="row">
      <span>Подбросить:</span>
      <button @click="emit('plantLetter', 'X')">Х</button>
      <button @click="emit('plantLetter', 'U')">У</button>
      <button @click="emit('plantLetter', 'I')">Й</button>
      <button @click="emit('plantWord')">Слово</button>
    </div>

    <p v-if="error" class="error">
      {{ error }}
      <button v-if="status === 'stopped-error'" @click="emit('gotoDemo')">Перейти в демо</button>
    </p>
  </section>
</template>

<style scoped>
.controls { display: flex; flex-direction: column; gap: 8px; }
label { display: flex; flex-direction: column; font-size: 13px; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.error { color: #ff8a80; font-size: 13px; }
.key { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.key input { flex: 1; min-width: 0; }
</style>
