import { Injectable, ConflictException } from "@nestjs/common";
import { StudentCodeGeneratorPort } from "@/application/ports/student-code-generator.port";
import { PrismaService } from "../prisma.service";

const MAX_SEQUENCE_NUMBER = 999999;

@Injectable()
export class StudentCodeGeneratorService extends StudentCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Generates next student code in format YYYY-XXXXXX for the given campus
   * Uses atomic database operation to prevent race conditions
   * Each campus maintains its own sequence counter per year
   *
   * @param campusId - The campus ID for which to generate the code
   * @returns Student code string (e.g., "2025-000001")
   * @throws ConflictException if sequence exhausted for the year
   */
  async generateNextCode(campusId: string): Promise<string> {
    const currentYear = new Date().getFullYear();

    // Atomic upsert with increment - prevents race conditions
    // Uses composite key (campusId, year) for campus-scoped sequences
    const sequence = await this.prisma.studentCodeSequence.upsert({
      where: {
        campusId_year: {
          campusId,
          year: currentYear,
        },
      },
      create: { campusId, year: currentYear, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    if (sequence.lastNumber > MAX_SEQUENCE_NUMBER) {
      throw new ConflictException(
        `Student code sequence exhausted for campus ${campusId} in year ${currentYear}. Maximum ${MAX_SEQUENCE_NUMBER} students per campus per year.`,
      );
    }

    // Format: YYYY-XXXXXX (e.g., "2025-000001")
    const paddedSequence = String(sequence.lastNumber).padStart(6, "0");
    return `${currentYear}-${paddedSequence}`;
  }
}
