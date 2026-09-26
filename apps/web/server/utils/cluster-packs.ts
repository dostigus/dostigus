import type { OpenedStore } from '@dostigus/db'
import type { BotViewer, PackApplyTarget, PackTree } from '@dostigus/shared'
import {
  applyPack,
  exportBotPack,
  previewPackApply,
  StoreError,
  validatePackTree,
} from '@dostigus/db'
import { PackInputError, packTreeToZip, parsePackUpload } from '@dostigus/shared'

function asPack<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof PackInputError) {
      throw new StoreError(error.message, error.statusCode)
    }
    throw error
  }
}

export function exportClusterPack(store: OpenedStore, botId: string, viewer: BotViewer) {
  const pack = exportBotPack(store, botId, viewer)
  const bytes = packTreeToZip(pack)
  const filename = `${pack.manifest.id}-${pack.manifest.version}.zip`
  return { pack, bytes, filename }
}

export function previewClusterPack(
  store: OpenedStore,
  tree: PackTree,
  target: PackApplyTarget,
  viewer: BotViewer,
) {
  return { pack: tree, plan: previewPackApply(store, tree, target, viewer) }
}

export function applyClusterPack(
  store: OpenedStore,
  tree: PackTree,
  target: PackApplyTarget,
  viewer: BotViewer,
) {
  return applyPack(store, tree, target, viewer)
}

export function packTreeFromUpload(input: {
  bytes?: Uint8Array
  filename?: string
  files?: Record<string, string>
}): PackTree {
  return asPack(() => parsePackUpload(input))
}

export function packTreeFromBody(value: unknown): PackTree {
  return validatePackTree(value)
}

export function packApplyTargetFromBody(body: {
  target?: string
  botId?: string
} = {}): PackApplyTarget {
  const kind = body.target === 'update' ? 'update' : 'create'
  return { kind, botId: body.botId }
}
