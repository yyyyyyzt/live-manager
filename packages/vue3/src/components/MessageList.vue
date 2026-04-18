<template>
  <div class="message-list-container" ref="containerRef">
    <!-- 使用 SDK 的 BarrageList 组件 -->
    <BarrageList
      ref="barrageListRef"
      :Message="CustomMessage"
      class="barrage-list-wrapper"
    />

    <!-- 下拉菜单 - 使用统一的下拉菜单组件 -->
    <Teleport to="body">
      <div
        v-if="dropdownVisible && selectedMessage"
        ref="dropdownRef"
        class="user-action-dropdown"
        :style="{
          position: 'fixed',
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
        }"
      >
        <button class="dropdown-item" @click="handleMuteClick">
          <CircleCheck v-if="isUserMuted(selectedMessage.sender.userId)" :size="18" />
          <MessageSquareOff v-else :size="18" />
          <span>{{ isUserMuted(selectedMessage.sender.userId) ? '解除禁言' : '禁言' }}</span>
        </button>
        <button class="dropdown-item danger" @click="handleBanClick">
          <UserCheck v-if="isUserBanned(selectedMessage.sender.userId)" :size="18" />
          <UserX v-else :size="18" />
          <span>{{ isUserBanned(selectedMessage.sender.userId) ? '解除封禁' : '封禁' }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, h, defineComponent } from 'vue';
import { BarrageList, useLoginState, useLiveListState, useLiveAudienceState } from 'tuikit-atomicx-vue3/live';
import { CircleCheck, MessageSquareOff, UserCheck, UserX } from 'lucide-vue-next';
import type { Barrage } from '@live-manager/common';
import { parseTextWithEmoji } from '@live-manager/common';
import '@live-manager/common/style/message-list.css';
import '@live-manager/common/components/user-action-dropdown/user-action-dropdown.css';

// Props 类型
interface Props {
  onMuteUser?: (userId: string, userName: string, isMuted: boolean) => void;
  onBanUser?: (userId: string, userName: string, isBanned: boolean) => void;
  mutedList?: Array<{ userId: string; endTime: number }>;
  bannedList?: Array<{ userId: string; endTime: number }>;
}

const props = withDefaults(defineProps<Props>(), {
  mutedList: () => [],
  bannedList: () => [],
});

const { loginUserInfo } = useLoginState();
const { currentLive } = useLiveListState();
const { audienceList, disableSendMessage: sdkDisableSendMessage } = useLiveAudienceState();

const dropdownVisible = ref(false);
const dropdownPosition = ref({ top: 0, left: 0 });
const selectedMessage = ref<Barrage | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const barrageListRef = ref<any>(null);

// 从观众列表中获取用户信息
const getAudienceInfo = (userId: string) => {
  return audienceList.value.find(item => item.userId === userId);
};

// 检查用户是否被禁言 (优先使用 SDK 观众列表状态)
const isUserMuted = (userId: string): boolean => {
  // 首先检查 SDK 观众列表中的禁言状态
  const audienceInfo = getAudienceInfo(userId);
  if (audienceInfo) {
    return audienceInfo.isMessageDisabled === true;
  }
  // 备用：检查 props 传入的禁言列表
  const mutedUser = props.mutedList.find(m => m.userId === userId);
  if (!mutedUser) return false;
  return mutedUser.endTime > Date.now() / 1000;
};

// 检查用户是否被封禁
const isUserBanned = (userId: string): boolean => {
  const bannedUser = props.bannedList.find(b => b.userId === userId);
  if (!bannedUser) return false;
  return bannedUser.endTime > Date.now() / 1000;
};

// 右键点击消息项
const handleContextMenu = (event: MouseEvent, message: Barrage) => {
  event.preventDefault();
  event.stopPropagation();

  // 如果是自己发送的消息,不显示菜单
  if (message.sender.userId === loginUserInfo.value?.userId) {
    return;
  }

  // 如果是主播的消息,不显示菜单
  if (message.sender.userId === currentLive.value?.liveOwner?.userId) {
    return;
  }

  // 如果是主播的 OBS 推流账号,不显示菜单
  if (message.sender.userId === `${currentLive.value?.liveOwner?.userId}_obs`) {
    return;
  }

  // 找到最接近的 message-item 元素
  const target = (event.target as HTMLElement).closest('.message-item');
  if (!target) return;

  const rect = target.getBoundingClientRect();
  // 使用 fixed 定位，直接使用页面的绝对坐标
  const top = rect.bottom + 4;
  const left = Math.min(
    rect.left,
    window.innerWidth - 150
  );

  dropdownPosition.value = { top, left: Math.max(0, left) };
  selectedMessage.value = message;
  dropdownVisible.value = true;
};

// 封禁/解除封禁用户
const handleBanClick = () => {
  if (selectedMessage.value && props.onBanUser) {
    const userId = selectedMessage.value.sender.userId;
    // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行封禁
    if (userId !== `${currentLive.value?.liveOwner?.userId}_obs`) {
      const userName = selectedMessage.value.sender.userName || selectedMessage.value.sender.nameCard || selectedMessage.value.sender.userId;
      const userIsBanned = isUserBanned(userId);
      props.onBanUser(userId, userName, userIsBanned);
    }
  }
  dropdownVisible.value = false;
  selectedMessage.value = null;
};

// 禁言/解除禁言用户 - 使用 SDK 的 disableSendMessage 方法
const handleMuteClick = async () => {
  if (!selectedMessage.value) return;

  const userId = selectedMessage.value.sender.userId;
  // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行禁言
  if (userId === `${currentLive.value?.liveOwner?.userId}_obs`) {
    dropdownVisible.value = false;
    selectedMessage.value = null;
    return;
  }

  const userName = selectedMessage.value.sender.userName || selectedMessage.value.sender.nameCard || selectedMessage.value.sender.userId;
  const userIsMuted = isUserMuted(userId);

  // 优先使用 SDK 的禁言功能
  try {
    await sdkDisableSendMessage({ userId, isDisable: !userIsMuted });
    console.log(userIsMuted ? '解除禁言成功' : '禁言成功');
  } catch (error) {
    console.error('SDK 禁言失败，使用备用方法:', error);
    // 备用：使用 props 传入的回调
    if (props.onMuteUser) {
      props.onMuteUser(userId, userName, userIsMuted);
    }
  }

  dropdownVisible.value = false;
  selectedMessage.value = null;
};



// 自定义消息组件 - 复制 SDK 原始实现 + 右键菜单
const CustomMessage = defineComponent({
  props: {
    message: {
      type: Object as () => Barrage,
      required: true,
    },
    isLastInChunk: {
      type: Boolean,
      default: true,
    },
    style: {
      type: Object as () => Record<string, any>,
      default: () => ({}),
    },
  },
  setup(props) {
    const displayName = props.message.sender.nameCard || props.message.sender.userName || props.message.sender.userId;
    const isAnchor = props.message.sender.userId === currentLive.value?.liveOwner?.userId;

    // 根据消息类型获取显示内容
    const displayText = props.message.messageType === 0 ? props.message.textContent : props.message.data || '';
    const messageContent = parseTextWithEmoji(displayText);

    // 渲染消息内容
    const renderContent = () => {
      return messageContent.map((item, index) => {
        if (item.type === 'emoji') {
          return h('img', {
            key: index,
            class: 'message-emoji',
            src: item.src,
            alt: item.key,
          });
        }
        return h('span', { key: index, class: 'message-text' }, item.text);
      });
    };

    return () => h('div', {
      class: ['message-item', isAnchor ? 'host' : ''],
      style: props.style,
      onContextMenu: (e: MouseEvent) => handleContextMenu(e, props.message),
    }, [
      // 主播标识
      isAnchor ? h('span', { class: 'message-badge' }, '主播') : null,
      // 昵称
      h('span', { class: 'message-username', onClick: (e: MouseEvent) => handleContextMenu(e, props.message) }, `${displayName}: `),
      // 消息内容
      h('span', { class: 'message-content' }, renderContent()),
    ]);
  },
});

// 点击外部关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && dropdownRef.value.contains(event.target as Node)) {
    return;
  }
  dropdownVisible.value = false;
  selectedMessage.value = null;
};

watch(dropdownVisible, (visible) => {
  if (visible) {
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
  }
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

