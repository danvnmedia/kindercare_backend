export interface StudentHealthArchiveState {
  archivedAt: Date | null;
  archivedByUserId: string | null;
}

export interface StudentHealthArchiveTransition {
  archivedAt: Date;
  archivedByUserId: string;
}

export function normalizeStudentHealthArchiveState(
  archivedAt: unknown,
  archivedByUserId: string | null | undefined,
): StudentHealthArchiveState {
  if (archivedAt === undefined || archivedAt === null) {
    if (archivedByUserId) {
      throw new Error("Archived-by user ID requires an archive timestamp");
    }

    return { archivedAt: null, archivedByUserId: null };
  }

  return {
    archivedAt: normalizeStudentHealthArchiveTimestamp(archivedAt),
    archivedByUserId: archivedByUserId ?? null,
  };
}

export function createStudentHealthArchiveTransition(
  actorUserId: string,
  archivedAt: unknown,
): StudentHealthArchiveTransition {
  if (!actorUserId?.trim()) {
    throw new Error("Archive actor user ID is required");
  }

  return {
    archivedAt: normalizeStudentHealthArchiveTimestamp(archivedAt),
    archivedByUserId: actorUserId,
  };
}

function normalizeStudentHealthArchiveTimestamp(value: unknown): Date {
  const timestamp = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Archive timestamp must be a valid date");
  }

  return timestamp;
}
