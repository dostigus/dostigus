import type { OpenedStore, PackExportWrite } from '@dostigus/db'
import type { BotViewer, PackApplyTarget, PackTree } from '@dostigus/shared'
import type { PackRemoteOptions } from './pack-remote'
import {
  applyPack,
  describePackExport,
  exportBotPack,
  previewPackApply,
  StoreError,
  validatePackTree,
} from '@dostigus/db'
import { PackInputError, packTreeToZip, parsePackUpload } from '@dostigus/shared'
import { fetchPackFromRemote } from './pack-remote'

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

export function exportClusterPack(
  store: OpenedStore,
  botId: string,
  viewer: BotViewer,
  options: PackExportWrite = {},
) {
  const pack = exportBotPack(store, botId, viewer, options)
  const bytes = packTreeToZip(pack)
  const filename = `${pack.manifest.id}-${pack.manifest.version}.zip`
  return { pack, bytes, filename }
}

export function describeClusterPackExport(store: OpenedStore, botId: string, viewer: BotViewer) {
  return describePackExport(store, botId, viewer)
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
  const tree = asPack(() => parsePackUpload(input))
  return { ...tree, source: tree.source ?? { kind: 'file' } }
}

export async function packTreeFromRemote(input: PackRemoteOptions): Promise<PackTree> {
  const fetched = await fetchPackFromRemote(input)
  return fetched.pack
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
