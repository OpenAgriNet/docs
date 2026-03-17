<template>
  <div
    ref="container"
    class="mermaid-zoom-container"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @dblclick="resetZoom"
  >
    <div
      class="mermaid-zoom-content"
      :style="transformStyle"
    >
      <slot />
    </div>
    <div class="mermaid-zoom-controls">
      <button @click="zoomIn" title="Zoom in">+</button>
      <button @click="zoomOut" title="Zoom out">&minus;</button>
      <button @click="resetZoom" title="Reset">&#8634;</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const container = ref(null)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)

const MIN_SCALE = 0.3
const MAX_SCALE = 5
const ZOOM_STEP = 0.15

const transformStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  transformOrigin: '0 0',
  cursor: isDragging.value ? 'grabbing' : 'grab',
}))

function onWheel(e) {
  const rect = container.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const prevScale = scale.value
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale + delta))

  // Zoom toward cursor position
  translateX.value = mouseX - (mouseX - translateX.value) * (newScale / prevScale)
  translateY.value = mouseY - (mouseY - translateY.value) * (newScale / prevScale)
  scale.value = newScale
}

function onMouseDown(e) {
  if (e.button !== 0) return
  isDragging.value = true
  startX.value = e.clientX - translateX.value
  startY.value = e.clientY - translateY.value
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!isDragging.value) return
  translateX.value = e.clientX - startX.value
  translateY.value = e.clientY - startY.value
}

function onMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, scale.value + ZOOM_STEP)
}

function zoomOut() {
  scale.value = Math.max(MIN_SCALE, scale.value - ZOOM_STEP)
}

function resetZoom() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<style scoped>
.mermaid-zoom-container {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  min-height: 300px;
  margin: 16px 0;
  user-select: none;
}

.mermaid-zoom-content {
  display: inline-block;
  padding: 16px;
  transition: transform 0.05s linear;
}

.mermaid-zoom-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 10;
}

.mermaid-zoom-controls button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.mermaid-zoom-controls button:hover {
  opacity: 1;
  background: var(--vp-c-bg-soft);
}
</style>
