export function isArchiveOperationAcknowledged({ feedback = "", countNow = 0, countBeforeArchive = 0 } = {}) {
  const text = String(feedback || "");
  const archivedByFeedback = /(archiv|archive|composer archive)/i.test(text);
  const before = Math.max(0, Number(countBeforeArchive) || 0);
  const now = Math.max(0, Number(countNow) || 0);
  const archivedByCount = now <= Math.max(0, before - 1);
  return archivedByFeedback || archivedByCount;
}
