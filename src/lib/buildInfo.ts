function formatBuildLabel(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return isoValue;

  return parsed.toLocaleString('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const APP_BUILD_ID = typeof __APP_BUILD_ID__ === 'string'
  ? __APP_BUILD_ID__
  : 'okänd';

export const APP_BUILD_LABEL = formatBuildLabel(APP_BUILD_ID);
