export abstract class StudentHardDeleteGuardPort {
  abstract countRetainedHistoricalRecords(
    studentId: string,
    campusId: string,
  ): Promise<number>;
}
