<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="dropdownRef"
      class="user-action-dropdown"
      :style="{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 1100,
      }"
    >
      <div v-if="userName" class="dropdown-header">
        {{ userName }}
      </div>
      <div v-if="userName" class="dropdown-divider" />
      <button
        v-if="showMute"
        class="dropdown-item"
        @click="handleMute"
      >
        <component :is="muted ? CheckCircleIcon : ChatOffIcon" />
        <span>{{ muted ? '解除禁言' : '禁言' }}</span>
      </button>
      <button
        v-if="showBan"
        class="dropdown-item"
        :class="{ danger: !banned }"
        @click="handleBan"
      >
        <component :is="banned ? UserCheckedIcon : UserBlockedIcon" />
        <span>{{ banned ? '解除封禁' : '封禁' }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, h } from 'vue';
import { ChatOffIcon, UserBlockedIcon, CheckCircleIcon, UserCheckedIcon } from 'tdesign-icons-vue-next';

export interface UserActionDropdownProps {
  visible: boolean;
  userId: string;
  userName?: string;
  muted?: boolean;
  banned?: boolean;
  showMute?: boolean;
  showBan?: boolean;
  position?: { top: number; left: number };
}

const props = withDefaults(defineProps<UserActionDropdownProps>(), {
  userName: '',
  muted: false,
  banned: false,
  showMute: true,
  showBan: true,
  position: () => ({ top: 0, left: 0 }),
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'mute', userId: string, userName: string, isMuted: boolean): void;
  (e: 'ban', userId: string, userName: string, isBanned: boolean): void;
}>();

const dropdownRef = ref<HTMLElement | null>(null);

// 点击外部关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && dropdownRef.value.contains(event.target as Node)) {
    return;
  }
  emit('update:visible', false);
};

watch(() => props.visible, (visible) => {
  if (visible) {
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
  }
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

const handleMute = () => {
  emit('mute', props.userId, props.userName, props.muted);
  emit('update:visible', false);
};

const handleBan = () => {
  emit('ban', props.userId, props.userName, props.banned);
  emit('update:visible', false);
};
</script>

<style scoped>
/* 样式在 shared CSS 中定义 */
</style>
