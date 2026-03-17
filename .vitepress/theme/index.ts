import DefaultTheme from 'vitepress/theme'
import MermaidZoom from './MermaidZoom.vue'
import { h, watch, nextTick, onMounted } from 'vue'
import type { Theme } from 'vitepress'
import './mermaid-zoom.css'

// Wrap rendered Mermaid SVGs with zoom containers on the client side
function wrapMermaidDiagrams() {
  if (typeof document === 'undefined') return

  const observer = new MutationObserver(() => {
    document.querySelectorAll('.mermaid:not(.zoom-wrapped)').forEach((el) => {
      el.classList.add('zoom-wrapped')

      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-zoom-auto'

      // State
      let scale = 1
      let translateX = 0
      let translateY = 0
      let isDragging = false
      let startX = 0
      let startY = 0

      const MIN_SCALE = 0.3
      const MAX_SCALE = 5
      const ZOOM_STEP = 0.15

      const content = document.createElement('div')
      content.className = 'mermaid-zoom-inner'

      // Move the mermaid element inside
      el.parentNode!.insertBefore(wrapper, el)
      content.appendChild(el)
      wrapper.appendChild(content)

      // Controls
      const controls = document.createElement('div')
      controls.className = 'mermaid-zoom-controls'
      controls.innerHTML = `
        <button title="Zoom in">+</button>
        <button title="Zoom out">&minus;</button>
        <button title="Reset">&#8634;</button>
      `
      wrapper.appendChild(controls)

      const [btnIn, btnOut, btnReset] = controls.querySelectorAll('button')

      function applyTransform() {
        content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
      }

      wrapper.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault()
        const rect = wrapper.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const prevScale = scale
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale + delta))
        translateX = mouseX - (mouseX - translateX) * (scale / prevScale)
        translateY = mouseY - (mouseY - translateY) * (scale / prevScale)
        applyTransform()
      }, { passive: false })

      wrapper.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return
        isDragging = true
        startX = e.clientX - translateX
        startY = e.clientY - translateY
        content.style.cursor = 'grabbing'
      })

      window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return
        translateX = e.clientX - startX
        translateY = e.clientY - startY
        applyTransform()
      })

      window.addEventListener('mouseup', () => {
        isDragging = false
        content.style.cursor = 'grab'
      })

      wrapper.addEventListener('dblclick', () => {
        scale = 1; translateX = 0; translateY = 0
        applyTransform()
      })

      btnIn.addEventListener('click', () => { scale = Math.min(MAX_SCALE, scale + ZOOM_STEP); applyTransform() })
      btnOut.addEventListener('click', () => { scale = Math.max(MIN_SCALE, scale - ZOOM_STEP); applyTransform() })
      btnReset.addEventListener('click', () => { scale = 1; translateX = 0; translateY = 0; applyTransform() })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('MermaidZoom', MermaidZoom)
    if (typeof window !== 'undefined') {
      wrapMermaidDiagrams()
    }
  },
}

export default theme
