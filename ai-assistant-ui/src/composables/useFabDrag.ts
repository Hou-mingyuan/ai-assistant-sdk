import { ref, computed, type Ref } from 'vue'

const FAB_SIZE = 56
const DRAG_CLICK_PX = 8
const DOCK_BREAK_PX = 10
const FAB_POS_KEY = 'ai-assistant-fab-pos-v4'

export interface FabDragState {
  fabLeft: Ref<number | null>
  fabTop: Ref<number | null>
  edgeDock: Ref<'none' | 'left' | 'right'>
  fabDragging: Ref<boolean>
}

export function useFabDrag(
  isOpen: Ref<boolean>,
  fabHidden: Ref<boolean>,
  persistFab: Ref<boolean>,
  position: string,
) {
  const fabLeft = ref<number | null>(null)
  const fabTop = ref<number | null>(null)
  const edgeDock = ref<'none' | 'left' | 'right'>('none')
  const fabDragging = ref(false)
  const fabDrag = ref<{
    pointerId: number
    startX: number
    startY: number
    originLeft: number
    originTop: number
  } | null>(null)

  function clampFabPos(left: number, top: number) {
    const m = 8
    const maxL = window.innerWidth - FAB_SIZE - m
    const maxT = window.innerHeight - FAB_SIZE - m
    return {
      left: Math.max(m, Math.min(left, maxL)),
      top: Math.max(m, Math.min(top, maxT)),
    }
  }

  function defaultFabCoords(): { left: number; top: number } {
    const m = 24
    const w = window.innerWidth
    const h = window.innerHeight
    switch (position) {
      case 'bottom-left':
        return { left: m, top: h - FAB_SIZE - m }
      case 'top-right':
        return { left: w - FAB_SIZE - m, top: m }
      case 'top-left':
        return { left: m, top: m }
      default:
        return { left: w - FAB_SIZE - m, top: h - FAB_SIZE - m }
    }
  }

  function loadFabPos() {
    if (!persistFab.value) return
    try {
      const raw = localStorage.getItem(FAB_POS_KEY)
      if (!raw) return
      const o = JSON.parse(raw)
      if (typeof o.left === 'number' && typeof o.top === 'number') {
        const c = clampFabPos(o.left, o.top)
        fabLeft.value = c.left
        fabTop.value = c.top
        if (o.edgeDock === 'left' || o.edgeDock === 'right') edgeDock.value = o.edgeDock
      }
    } catch {}
  }

  function saveFabPos(edgeDockOverride?: 'none' | 'left' | 'right') {
    if (!persistFab.value || fabLeft.value === null || fabTop.value === null) return
    const dock = edgeDockOverride ?? edgeDock.value
    try {
      localStorage.setItem(FAB_POS_KEY, JSON.stringify({ left: fabLeft.value, top: fabTop.value, edgeDock: dock }))
    } catch {}
  }

  function dockFab(edge: 'none' | 'left' | 'right') {
    if (fabLeft.value === null || fabTop.value === null) {
      const d = defaultFabCoords()
      fabLeft.value = d.left
      fabTop.value = d.top
    }
    edgeDock.value = edge
    if (edge === 'left') {
      fabLeft.value = 0
    } else if (edge === 'right') {
      fabLeft.value = window.innerWidth - FAB_SIZE
    } else {
      if (fabLeft.value! <= 8) fabLeft.value = 24
      else if (fabLeft.value! >= window.innerWidth - FAB_SIZE - 8) {
        fabLeft.value = window.innerWidth - FAB_SIZE - 24
      }
    }
    const c = clampFabPos(fabLeft.value!, fabTop.value!)
    fabLeft.value = c.left
    fabTop.value = c.top
    saveFabPos()
  }

  function onFabPointerMove(e: PointerEvent) {
    if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return
    const d = fabDrag.value
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.hypot(dx, dy) > DOCK_BREAK_PX) {
      edgeDock.value = 'none'
    }
    if (edgeDock.value !== 'none') return
    const c = clampFabPos(d.originLeft + dx, d.originTop + dy)
    fabLeft.value = c.left
    fabTop.value = c.top
  }

  function onFabPointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onFabPointerMove)
    window.removeEventListener('pointerup', onFabPointerUp)
    window.removeEventListener('pointercancel', onFabPointerUp)
    if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return
    const d = fabDrag.value
    fabDrag.value = null
    fabDragging.value = false
    const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
    if (moved < DRAG_CLICK_PX) {
      isOpen.value = true
    }
    saveFabPos()
  }

  function onFabPointerDown(e: PointerEvent) {
    if (isOpen.value || fabHidden.value || e.button !== 0) return
    e.preventDefault()
    if (fabLeft.value === null || fabTop.value === null) {
      const d = defaultFabCoords()
      fabLeft.value = d.left
      fabTop.value = d.top
    }
    let L = fabLeft.value!
    let T = fabTop.value!
    if (edgeDock.value === 'left') L = 0
    else if (edgeDock.value === 'right') L = window.innerWidth - FAB_SIZE
    fabLeft.value = L
    fabTop.value = T
    fabDrag.value = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originLeft: L, originTop: T }
    fabDragging.value = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    window.addEventListener('pointermove', onFabPointerMove)
    window.addEventListener('pointerup', onFabPointerUp)
    window.addEventListener('pointercancel', onFabPointerUp)
  }

  function cleanupFabDrag() {
    window.removeEventListener('pointermove', onFabPointerMove)
    window.removeEventListener('pointerup', onFabPointerUp)
    window.removeEventListener('pointercancel', onFabPointerUp)
  }

  const edgeDockClass = computed(() => {
    if (isOpen.value || fabDragging.value) return ''
    if (edgeDock.value === 'left') return 'edge-dock-left'
    if (edgeDock.value === 'right') return 'edge-dock-right'
    return ''
  })

  return {
    fabLeft,
    fabTop,
    edgeDock,
    fabDragging,
    edgeDockClass,
    clampFabPos,
    defaultFabCoords,
    loadFabPos,
    saveFabPos,
    dockFab,
    onFabPointerDown,
    cleanupFabDrag,
    FAB_SIZE,
  }
}
