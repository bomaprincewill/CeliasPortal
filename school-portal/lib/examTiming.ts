export const SUBMISSION_GRACE_MS = 5_000;

export function examDeadline(startedAt: Date, durationMinutes: number, scheduledEnd: Date) {
  return new Date(Math.min(startedAt.getTime() + durationMinutes * 60_000, scheduledEnd.getTime()));
}

export function attemptExpired(deadline: Date, now: Date = new Date()) {
  // A short transport allowance lets the automatic deadline submission arrive.
  return now.getTime() > deadline.getTime() + SUBMISSION_GRACE_MS;
}
