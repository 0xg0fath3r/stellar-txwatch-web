import { AlertRule } from '@/types'

/**
 * Shared formatting helpers for dates used across the app.
 * For ID truncation use truncateId() from @/lib/stellar.
 *
 * Note: formatDate/formatDateTime here always use the browser's local
 * timezone. Components that need to respect the user's UTC/local toggle
 * should use useTimezone() from @/components/TimezoneProvider instead.
 */

/** Formats a Unix ms timestamp as a locale date string (e.g. "5/29/2026"). */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

/** Formats a Unix ms timestamp as a locale date+time string. */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

/** Returns the full ISO-8601 UTC string for a timestamp (e.g. "2026-05-29T12:00:00.000Z"). */
export function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

/** Formats an alert rule as a human-readable summary string. */
export function formatRuleSummary(rule: AlertRule): string {
  switch (rule.type) {
    case 'LargeTransfer':
      return `>= ${rule.threshold_xlm} XLM`
    case 'FunctionCalled':
      return rule.function_name || 'function'
    case 'AdminFunctionCalled':
      return rule.function_names?.join(', ') || 'admin functions'
    default:
      return ''
  }
}
