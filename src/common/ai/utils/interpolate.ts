/**
 * Minimal {{path}} interpolator for dot-notation lookups on plain objects.
 * - Replaces placeholders like {{foo.bar}} with values from `data`.
 * - Missing/null values become empty string.
 * - Objects are JSON.stringified to avoid "[object Object]".
 * Designed for trusted, small templates (e.g., rule detail strings), not a general-purpose engine.
 */
export function interpolateTemplate(template: string, data: Record<string, unknown>) {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, path) => {
    const segments = String(path).split('.');
    let value: unknown = data;

    for (const key of segments) {
      if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[key];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  });
}
