import type { Artifact } from '@dostigus/shared'
import {
  ARTIFACT_LONG_PASTE_CHARS,
  ARTIFACT_UI_MAX_BYTES,
  ARTIFACTS_PER_MESSAGE_MAX,
  formatArtifactBytes,
  isImageArtifactMime,
} from '@dostigus/shared'

export type PendingAttachment = {
  localId: string
  filename: string
  mime: string
  byteSize: number
  previewUrl: string | null
  status: 'uploading' | 'ready' | 'error'
  artifactId?: string
  error?: string
}

export function useComposerAttachments() {
  const items = ref<PendingAttachment[]>([])
  const fileInput = ref<HTMLInputElement | null>(null)
  const dropActive = ref(false)
  let dragDepth = 0

  const readyIds = computed(() => (
    items.value
      .filter((item) => item.status === 'ready' && item.artifactId)
      .map((item) => item.artifactId!)
  ))
  const uploading = computed(() => items.value.some((item) => item.status === 'uploading'))
  const canSendAttachments = computed(() => readyIds.value.length > 0 && !uploading.value)

  function revoke(item: PendingAttachment) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  }

  function clear() {
    for (const item of items.value) {
      revoke(item)
    }
    items.value = []
  }

  function roomLeft() {
    return ARTIFACTS_PER_MESSAGE_MAX - items.value.length
  }

  async function uploadFile(file: File) {
    if (roomLeft() <= 0) {
      return
    }
    if (file.size > ARTIFACT_UI_MAX_BYTES) {
      return
    }
    const localId = crypto.randomUUID()
    const previewUrl = isImageArtifactMime(file.type) ? URL.createObjectURL(file) : null
    const pending: PendingAttachment = {
      localId,
      filename: file.name || 'file',
      mime: file.type || 'application/octet-stream',
      byteSize: file.size,
      previewUrl,
      status: 'uploading',
    }
    items.value = [...items.value, pending]
    const uploadId = crypto.randomUUID()
    try {
      const body = new FormData()
      body.append('file', file, file.name || 'file')
      body.append('uploadId', uploadId)
      const result = await $fetch<{ artifact: Artifact }>('/api/artifacts', {
        method: 'POST',
        body,
      })
      items.value = items.value.map((item) => {
        if (item.localId !== localId) {
          return item
        }
        return {
          ...item,
          status: 'ready',
          artifactId: result.artifact.id,
          filename: result.artifact.filename,
          mime: result.artifact.mime,
          byteSize: result.artifact.byteSize,
        }
      })
    } catch {
      items.value = items.value.map((item) => (
        item.localId === localId
          ? { ...item, status: 'error', error: 'Could not upload that file.' }
          : item
      ))
    }
  }

  function addFiles(list: FileList | File[] | null | undefined) {
    if (!list || list.length === 0) {
      return
    }
    const files = [...list].slice(0, roomLeft())
    for (const file of files) {
      void uploadFile(file)
    }
  }

  function pick() {
    fileInput.value?.click()
  }

  function onFileInput(event: Event) {
    const target = event.target as HTMLInputElement
    addFiles(target.files)
    target.value = ''
  }

  function remove(localId: string) {
    const item = items.value.find((row) => row.localId === localId)
    if (item) {
      revoke(item)
    }
    items.value = items.value.filter((row) => row.localId !== localId)
  }

  function hasFileDrag(event: DragEvent) {
    return event.dataTransfer?.types.includes('Files') === true
  }

  function onWindowDragEnter(event: DragEvent) {
    if (!hasFileDrag(event)) {
      return
    }
    event.preventDefault()
    dragDepth += 1
    dropActive.value = true
  }

  function onWindowDragLeave(event: DragEvent) {
    if (!hasFileDrag(event)) {
      return
    }
    event.preventDefault()
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) {
      dropActive.value = false
    }
  }

  function onWindowDragOver(event: DragEvent) {
    if (!hasFileDrag(event)) {
      return
    }
    event.preventDefault()
  }

  function onWindowDrop(event: DragEvent) {
    if (!hasFileDrag(event)) {
      return
    }
    event.preventDefault()
    dragDepth = 0
    dropActive.value = false
    addFiles(event.dataTransfer?.files)
  }

  function onPaste(event: ClipboardEvent) {
    const files = event.clipboardData?.files
    if (files && files.length > 0) {
      event.preventDefault()
      addFiles(files)
      return
    }
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (text.length >= ARTIFACT_LONG_PASTE_CHARS) {
      event.preventDefault()
      const file = new File([text], 'paste.txt', { type: 'text/plain' })
      void uploadFile(file)
    }
  }

  function bindWindow() {
    window.addEventListener('dragenter', onWindowDragEnter)
    window.addEventListener('dragleave', onWindowDragLeave)
    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('drop', onWindowDrop)
  }

  function unbindWindow() {
    window.removeEventListener('dragenter', onWindowDragEnter)
    window.removeEventListener('dragleave', onWindowDragLeave)
    window.removeEventListener('dragover', onWindowDragOver)
    window.removeEventListener('drop', onWindowDrop)
    dragDepth = 0
    dropActive.value = false
  }

  return {
    items,
    fileInput,
    dropActive,
    readyIds,
    uploading,
    canSendAttachments,
    formatArtifactBytes,
    pick,
    onFileInput,
    remove,
    onPaste,
    addFiles,
    clear,
    bindWindow,
    unbindWindow,
  }
}
