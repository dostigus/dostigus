import type { PackApplyPlan, PackTree } from '@dostigus/shared'

type PackApplyState = {
  open: boolean
  url: string
  previewing: boolean
  error: string
  pack: PackTree | null
  plan: PackApplyPlan | null
}

type ValidationResult
  = | { ok: true, url: string }
    | { ok: false, key: string }

/**
 * Host-level Pack Apply from a deep-link query param.
 * When the Host opens with `?applyPack=<encoded https zip URL>`,
 * this composable reads the URL, validates it, triggers preview,
 * and opens the Pack apply Sheet. See ADR 0047.
 */
export function useHostPackApply() {
  const state = useState<PackApplyState>('host-pack-apply', () => ({
    open: false,
    url: '',
    previewing: false,
    error: '',
    pack: null,
    plan: null,
  }))

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()

  function isValidApplyPackUrl(value: string): ValidationResult {
    if (!value.trim()) {
      return { ok: false, key: 'pack.deepLinkUrlRequired' }
    }
    let parsed: URL
    try {
      parsed = new URL(value.trim())
    } catch {
      return { ok: false, key: 'pack.deepLinkInvalidUrl' }
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, key: 'pack.deepLinkHttpsOnly' }
    }
    const pathname = parsed.pathname.toLowerCase()
    if (!pathname.endsWith('.zip')) {
      return { ok: false, key: 'pack.deepLinkZipOnly' }
    }
    return { ok: true, url: parsed.href }
  }

  function stripApplyPackParam() {
    const query = { ...route.query }
    delete query.applyPack
    router.replace({ query })
  }

  async function previewFromUrl(url: string) {
    state.value.previewing = true
    state.value.error = ''
    state.value.open = true
    try {
      const body = await $fetch<{ pack: PackTree, plan: PackApplyPlan }>('/api/packs/preview', {
        method: 'POST',
        body: { url, target: 'create' },
      })
      state.value.pack = body.pack
      state.value.plan = body.plan
    } catch (caught) {
      const err = caught as { statusMessage?: string, message?: string }
      state.value.error = err.statusMessage || err.message || t('pack.previewFailed')
    } finally {
      state.value.previewing = false
    }
  }

  async function consumeApplyPackParam() {
    const applyPack = route.query.applyPack
    if (typeof applyPack !== 'string' || !applyPack) {
      return
    }
    stripApplyPackParam()
    const decoded = decodeURIComponent(applyPack)
    const validation = isValidApplyPackUrl(decoded)
    if (!validation.ok) {
      state.value.error = t(validation.key)
      state.value.open = true
      return
    }
    state.value.url = validation.url
    await previewFromUrl(validation.url)
  }

  function close() {
    state.value.open = false
    state.value.pack = null
    state.value.plan = null
    state.value.error = ''
    state.value.url = ''
  }

  return {
    open: computed(() => state.value.open),
    previewing: computed(() => state.value.previewing),
    error: computed(() => state.value.error),
    pack: computed(() => state.value.pack),
    plan: computed(() => state.value.plan),
    url: computed(() => state.value.url),
    consumeApplyPackParam,
    close,
  }
}
