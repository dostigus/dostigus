import type { LlmGatewayPublic } from '@dostigus/shared'
import { getLlmGatewaySettings } from '@dostigus/db'
import { toPublicLlmGateway } from '@dostigus/shared'

export function publicLlmGateway(): LlmGatewayPublic {
  const stored = getLlmGatewaySettings(useStore())
  return toPublicLlmGateway({
    resolved: resolveClusterLlmGateway({ stored }),
    stored,
  })
}
