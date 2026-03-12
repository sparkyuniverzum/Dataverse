export function resolveDragCenter(event) {
  const translated = event?.active?.rect?.current?.translated;
  const initial = event?.active?.rect?.current?.initial;
  const rect = translated || initial;
  if (!rect) return null;
  return {
    x: Number(rect.left) + Number(rect.width) / 2,
    y: Number(rect.top) + Number(rect.height) / 2,
  };
}
