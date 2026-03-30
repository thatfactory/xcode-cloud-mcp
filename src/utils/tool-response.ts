/**
 * Wrap a JSON payload into an MCP text response.
 */
export function jsonResponse(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * Wrap an error message into an MCP error response.
 */
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Error: ${message}`,
      },
    ],
    isError: true,
  };
}
