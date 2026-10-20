import { z } from 'zod'
import {
  NetworkSchema,
  AlertRuleTypeSchema,
  AlertRuleSchema,
  WatchedContractSchema,
  AlertPayloadSchema,
} from '@/lib/schemas'

// Types are inferred from the zod schemas in lib/schemas.ts, which are the
// single source of truth for both compile-time types and runtime validation.
export type Network = z.infer<typeof NetworkSchema>

export type AlertRuleType = z.infer<typeof AlertRuleTypeSchema>

export type AlertRule = z.infer<typeof AlertRuleSchema>

export type WatchedContract = z.infer<typeof WatchedContractSchema>

export type AlertPayload = z.infer<typeof AlertPayloadSchema>
