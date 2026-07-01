export function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = params[key];
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
