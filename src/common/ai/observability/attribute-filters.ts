/**
 * Attribute filtering utilities for Langfuse OTEL exports.
 * Reduces verbose metadata by filtering resource attributes and tools arrays.
 */

/**
 * Resource attribute prefixes to filter out
 */
const FILTERED_RESOURCE_PREFIXES = ['process.', 'host.'];

/**
 * Filters out verbose resource attributes (process.* and host.*).
 * Keeps important attributes like service.*, telemetry.*, and custom attributes.
 *
 * @param attributes - Original resource attributes
 * @returns Filtered attributes without process.* and host.* keys
 */
export function filterResourceAttributes(attributes: Record<string, unknown>) {
  if (!attributes || typeof attributes !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => !FILTERED_RESOURCE_PREFIXES.some((prefix) => key.startsWith(prefix))),
  );
}

/**
 * Main filtering function that applies all filters to span attributes.
 * Removes any attribute keys that are 'tools' or end with '.tools'.
 *
 * @param attributes - Span attributes
 * @returns Filtered attributes with tools removed
 */
export function filterSpanAttributes(attributes: Record<string, unknown>) {
  if (!attributes || typeof attributes !== 'object') {
    return {};
  }

  // Filter out any keys that are 'tools' or end with '.tools'
  return Object.fromEntries(Object.entries(attributes).filter(([key]) => key !== 'tools' && !key.endsWith('.tools')));
}
