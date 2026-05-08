<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="umo-ai-action-progress"
      :style="positionStyle"
    >
      <div class="umo-ai-action-progress-title">
        <span>{{ t(`tools.aiActions.${action}`) }}</span>
        <button type="button" @click="emits('stop')">停止</button>
      </div>
      <div class="umo-ai-action-progress-percent">{{ progress }}%</div>
      <div class="umo-ai-action-progress-track">
        <div
          class="umo-ai-action-progress-bar"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  progress: {
    type: Number,
    default: 0,
  },
  action: {
    type: String,
    default: 'write',
  },
  position: {
    type: Object,
    default: null,
  },
})

const emits = defineEmits(['stop'])

const positionStyle = $computed(() => {
  if (props.position) {
    return {
      left: `${props.position.x}px`,
      top: `${props.position.y}px`,
    }
  }
  return {
    right: '16px',
    bottom: '56px',
  }
})
</script>

<style lang="less">
.umo-ai-action-progress {
  position: fixed;
  z-index: 6000;
  width: 240px;
  padding: 10px 12px;
  border: solid 1px var(--umo-border-color);
  border-radius: 6px;
  background-color: var(--umo-color-white);
  box-shadow: var(--td-shadow-2);
}
.umo-ai-action-progress-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  color: var(--umo-text-color);
  font-size: 13px;
  button {
    border: none;
    background: transparent;
    color: var(--umo-primary-color);
    cursor: pointer;
    font-size: 12px;
    padding: 0;
  }
}
.umo-ai-action-progress-percent {
  margin-bottom: 8px;
  color: var(--umo-text-color-light);
  font-size: 12px;
  text-align: right;
}
.umo-ai-action-progress-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background-color: var(--umo-border-color-light);
}
.umo-ai-action-progress-bar {
  height: 100%;
  border-radius: inherit;
  background-color: var(--umo-primary-color);
  transition: width 0.2s ease;
}
</style>
