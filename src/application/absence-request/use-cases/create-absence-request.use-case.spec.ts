import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";

import {
  AbsenceRequestRepository,
  CreateAbsenceRequestUseCase,
} from "@/application/absence-request";
import { AbsenceRequest, AbsenceRequestType } from "@/domain/absence-request";
import {
  createGuardian,
  createMockGuardianRepository,
  createStudent,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

describe("CreateAbsenceRequestUseCase", () => {
  let absenceRequestRepository: jest.Mocked<AbsenceRequestRepository>;
  let guardianRepository: ReturnType<typeof createMockGuardianRepository>;
  let useCase: CreateAbsenceRequestUseCase;

  const user = createUser({
    id: "44444444-4444-4444-a444-444444444444",
  });
  const guardian = createGuardian({
    id: "33333333-3333-4333-a333-333333333333",
    userId: user.id.toString(),
  });
  const student = createStudent({
    id: "22222222-2222-4222-a222-222222222222",
  });

  beforeEach(() => {
    absenceRequestRepository = {
      findByIdInCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findByRequesterGuardianId: jest.fn(),
      findActiveOverlaps: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (request: AbsenceRequest) => request),
      update: jest.fn(),
    } as jest.Mocked<AbsenceRequestRepository>;

    guardianRepository = createMockGuardianRepository();
    guardianRepository.findByUserIdInCampus.mockResolvedValue(guardian);
    guardianRepository.getGuardianChildrenInCampus.mockResolvedValue([
      {
        student,
        guardianRelationship: {
          id: "77777777-7777-4777-a777-777777777777",
          name: "Mother",
        },
      },
    ]);

    useCase = new CreateAbsenceRequestUseCase(
      absenceRequestRepository,
      guardianRepository,
    );
  });

  it("creates an absence request for a linked guardian child", async () => {
    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, user, {
      studentId: student.id.toString(),
      absenceType: AbsenceRequestType.PARTIAL_DAY,
      startDate: "2099-07-10",
      startTime: "09:00",
      endTime: "12:00",
      description: "Medical appointment",
    });

    expect(result.studentId).toBe(student.id.toString());
    expect(result.requesterGuardianId).toBe(guardian.id.toString());
    expect(result.startTime).toBe("09:00");
    expect(result.endTime).toBe("12:00");
    expect(absenceRequestRepository.findActiveOverlaps).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      student.id.toString(),
      result.period,
    );
    expect(absenceRequestRepository.save).toHaveBeenCalledWith(result);
  });

  it("ignores client-provided guardian identity fields", async () => {
    const forgedInput = {
      studentId: student.id.toString(),
      requesterGuardianId: "99999999-9999-4999-a999-999999999999",
      guardianId: "99999999-9999-4999-a999-999999999999",
      absenceType: AbsenceRequestType.FULL_DAY,
      startDate: "2099-07-10",
      description: "Family appointment",
    } as unknown as Parameters<CreateAbsenceRequestUseCase["execute"]>[2];

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      user,
      forgedInput,
    );

    expect(result.requesterGuardianId).toBe(guardian.id.toString());
    expect(guardianRepository.findByUserIdInCampus).toHaveBeenCalledWith(
      user.id.toString(),
      DEFAULT_CAMPUS_ID_A,
    );
    expect(guardianRepository.getGuardianChildrenInCampus).toHaveBeenCalledWith(
      guardian.id.toString(),
      DEFAULT_CAMPUS_ID_A,
    );
  });

  it("rejects requests for students not linked to the current guardian", async () => {
    guardianRepository.getGuardianChildrenInCampus.mockResolvedValue([]);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, {
        studentId: student.id.toString(),
        absenceType: AbsenceRequestType.FULL_DAY,
        startDate: "2099-07-10",
        description: "Family appointment",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(absenceRequestRepository.save).not.toHaveBeenCalled();
  });

  it("rejects active overlapping requests for the same student", async () => {
    const existing = AbsenceRequest.create({
      campusId: DEFAULT_CAMPUS_ID_A,
      studentId: student.id.toString(),
      requesterGuardianId: guardian.id.toString(),
      requesterUserId: user.id.toString(),
      absenceType: AbsenceRequestType.FULL_DAY,
      startDate: new Date("2099-07-10T00:00:00.000Z"),
      endDate: new Date("2099-07-10T00:00:00.000Z"),
      description: "Existing request",
    });
    absenceRequestRepository.findActiveOverlaps.mockResolvedValue([existing]);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, {
        studentId: student.id.toString(),
        absenceType: AbsenceRequestType.FULL_DAY,
        startDate: "2099-07-10",
        description: "Family appointment",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(absenceRequestRepository.save).not.toHaveBeenCalled();
  });

  it("rejects past-dated requests", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, {
        studentId: student.id.toString(),
        absenceType: AbsenceRequestType.FULL_DAY,
        startDate: "2000-01-01",
        description: "Past request",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
