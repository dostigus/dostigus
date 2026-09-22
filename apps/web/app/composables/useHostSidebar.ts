export function useHostSidebar() {
  const width = useState('host-sidebar-width', () => SIDEBAR_DEFAULT)
  const collapsed = useState('host-sidebar-collapsed', () => false)
  const ready = useState('host-sidebar-ready', () => false)

  onMounted(() => {
    if (ready.value) {
      return
    }
    try {
      const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { width?: unknown, collapsed?: unknown }
        if (typeof parsed.width === 'number' && Number.isFinite(parsed.width)) {
          const next = nextSidebar(SIDEBAR_DEFAULT, parsed.width)
          if (!next.collapsed) {
            width.value = next.width
          }
        }
        if (parsed.collapsed === true) {
          collapsed.value = true
        }
      }
    } catch {
      // A broken preference falls back to the default width.
    }
    ready.value = true
  })

  watch([width, collapsed], () => {
    if (!ready.value) {
      return
    }
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({
        width: width.value,
        collapsed: collapsed.value,
      }))
    } catch {
      // Preference storage can be unavailable.
    }
  })

  function resizeTo(requested: number) {
    const next = nextSidebar(width.value, requested)
    width.value = next.width
    collapsed.value = next.collapsed
  }

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
  }

  return { width, collapsed, resizeTo, toggleCollapsed }
}
