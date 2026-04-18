<template>
  <div :class="className" :title="title" :aria-label="altText">
    <img
      v-if="currentSrc && !showTextFallback"
      :src="currentSrc"
      :alt="altText"
      @error="handleImageError"
    />
    <span v-else class="avatar-fallback">{{ fallbackInitial }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { defaultAvatarUrl } from '@live-manager/common';
import { getFallbackInitial } from '@/utils/anchor';

interface Props {
  className?: string;
  name?: string;
  src?: string;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  className: 'anchor-avatar',
  name: '',
  src: '',
  title: '',
});

const currentSrc = ref('');
const showTextFallback = ref(false);

const altText = computed(() => props.name ? `${props.name}头像` : '主播头像');
const fallbackInitial = computed(() => getFallbackInitial(props.name));

watch(() => props.src, (newSrc) => {
  currentSrc.value = newSrc || defaultAvatarUrl;
  showTextFallback.value = false;
}, { immediate: true });

const handleImageError = () => {
  if (currentSrc.value !== defaultAvatarUrl) {
    currentSrc.value = defaultAvatarUrl;
    return;
  }
  showTextFallback.value = true;
};
</script>
