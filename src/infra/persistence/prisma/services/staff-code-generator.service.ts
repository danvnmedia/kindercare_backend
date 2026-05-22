import { Injectable, ConflictException } from "@nestjs/common";
import { StaffCodeGeneratorPort } from "@/application/ports/staff-code-generator.port";
import { PrismaService } from "../prisma.service";

const MAX_SEQUENCE_NUMBER = 999999;
const STAFF_CODE_PREFIX = "ST-";

@Injectable()
export class StaffCodeGeneratorService extends StaffCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Generates next staff code in format `ST-YYYY-XXXXXX` for the given campus.
   * Uses atomic database operation to prevent race conditions.
   * Each campus maintains its own sequence counter per year.
   *
   * @param campusId - The campus ID for which to generate the code.
   * @returns Staff code string (e.g., `ST-2025-000001`).
   * @throws ConflictException if sequence exhausted for the year.
   */
  async generateNextCode(campusId: string): Promise<string> {
    const currentYear = new Date().getFullYear();

    const sequence = await this.prisma.staffCodeSequence.upsert({
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
        `Staff code sequence exhausted for campus ${campusId} in year ${currentYear}. Maximum ${MAX_SEQUENCE_NUMBER} staff per campus per year.`,
      );
    }

    const paddedSequence = String(sequence.lastNumber).padStart(6, "0");
    return `${STAFF_CODE_PREFIX}${currentYear}-${paddedSequence}`;
  }
}
