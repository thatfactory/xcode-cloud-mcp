/**
 * Parse an identifier that may be a bare resource id or a xcode-cloud URI.
 */
export function parseIdentifier(
  value: string,
  prefix: 'product' | 'workflow' | 'build-run',
): string {
  const uriPrefix = `xcode-cloud://${prefix}/`;

  if (value.startsWith(uriPrefix)) {
    return value.slice(uriPrefix.length);
  }

  return value;
}
