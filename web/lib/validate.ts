// Input validation utilities for API routes

const NSE_SYMBOL_REGEX = /^[A-Z0-9&\-\.]{1,20}$/

/**
 * Validates and normalizes a stock symbol
 * @throws Error if symbol is invalid
 */
export function validateSymbol(symbol: string): string {
  const clean = decodeURIComponent(symbol).trim().toUpperCase()
  if (!NSE_SYMBOL_REGEX.test(clean)) {
    throw new Error(`Invalid symbol: ${clean}`)
  }
  return clean
}

/**
 * Validates a positive integer parameter
 * @throws Error if parameter is invalid
 */
export function validatePositiveInt(val: string, max: number): number {
  const n = parseInt(val)
  if (isNaN(n) || n < 1 || n > max) throw new Error('Invalid parameter')
  return n
}

/**
 * Validates a date string (YYYY-MM-DD format)
 */
export function validateDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format')
  }
  return dateStr
}

/**
 * Validates an enum value
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: readonly T[]
): T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`Invalid value: ${value}. Allowed: ${allowedValues.join(', ')}`)
  }
  return value as T
}
