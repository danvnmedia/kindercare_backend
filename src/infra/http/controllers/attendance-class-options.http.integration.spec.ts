import "reflect-metadata";

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";

import { BulkRecordAttendanceUseCase } from "@/application/attendance/use-cases/bulk-record-attendance.use-case";
import { GetAttendanceByIdUseCase } from "@/application/attendance/use-cases/get-attendance-by-id.use-case";
import { GetAttendanceClassOptionsUseCase } from "@/application/attendance/use-cases/get-attendance-class-options.use-case";
import { GetClassAttendanceUseCase } from "@/application/attendance/use-cases/get-class-attendance.use-case";
import { GetClassRollCallUseCase } from "@/application/attendance/use-cases/get-class-roll-call.use-case";
import { GetStudentAttendanceUseCase } from "@/application/attendance/use-cases/get-student-attendance.use-case";
import { RecordAttendanceUseCase } from "@/application/attendance/use-cases/record-attendance.use-case";
import { SaveClassRollCallUseCase } from "@/application/attendance/use-cases/save-class-roll-call.use-case";
import { UpdateAttendanceUseCase } from "@/application/attendance/use-cases/update-attendance.use-case";
import { QueryValidatorService } from "@/core/modules/standard-response/services/query-validator.service";
import { StandardResponseInterceptor } from "@/core/modules/standard-response/interceptors/standard-response.interceptor";
import { User } from "@/domain/user-management/user.entity";

import { RequestContext } from "../context/request-context.service";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { AttendanceController } from "./attendance.controller";

const CAMPUS_A_ID = "11111111-1111-4111-a111-111111111111";
const CAMPUS_B_ID = "22222222-2222-4222-a222-222222222222";
const CLASS_ID = "33333333-3333-4333-a333-333333333333";

function buildUser(campusId: string, permissionIds: string[]): User {
  const roles = [
    {
      campusId,
      permissions: permissionIds.map((id) => ({ id })),
    },
  ];

  return {
    id: "44444444-4444-4444-a444-444444444444",
    profiles: [{ type: "staff", campusId }],
    getGlobalRoles: () => [],
    getRolesForCampus: (requestedCampusId: string | null) =>
      requestedCampusId === campusId ? roles : [],
  } as unknown as User;
}

describe("GET /attendance/class-options HTTP integration", () => {
  let app: INestApplication;
  let currentUser: User;

  const getAttendanceClassOptionsUseCase = {
    execute: jest.fn(),
  };
  const getAttendanceByIdUseCase = {
    execute: jest.fn(),
  };
  const campusRepository = {
    findById: jest.fn().mockImplementation(async (campusId: string) => ({
      id: campusId,
      isArchived: false,
    })),
  };
  const requestContext = {
    clerkId: "clerk_http_integration",
    campusId: null as string | null,
    getUser: jest.fn(async () => currentUser),
    setCampusId: jest.fn((campusId: string | null) => {
      requestContext.campusId = campusId;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        Reflector,
        ClerkAuthGuard,
        CampusGuard,
        PermissionsGuard,
        QueryValidatorService,
        { provide: RequestContext, useValue: requestContext },
        { provide: "CAMPUS_REPOSITORY", useValue: campusRepository },
        {
          provide: RecordAttendanceUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: UpdateAttendanceUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetAttendanceByIdUseCase,
          useValue: getAttendanceByIdUseCase,
        },
        {
          provide: GetClassAttendanceUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetStudentAttendanceUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: BulkRecordAttendanceUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetClassRollCallUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: SaveClassRollCallUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetAttendanceClassOptionsUseCase,
          useValue: getAttendanceClassOptionsUseCase,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    app.useGlobalInterceptors(
      new StandardResponseInterceptor(
        module.get(Reflector),
        module.get(QueryValidatorService),
      ),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = buildUser(CAMPUS_A_ID, ["attendance.read"]);
    requestContext.campusId = null;
    getAttendanceClassOptionsUseCase.execute.mockResolvedValue({
      data: [
        {
          id: CLASS_ID,
          name: "Sunflower A",
          code: null,
          internalOnly: "not serialized",
        },
      ],
      pagination: {
        limit: 2,
        offset: 1,
        total: 5,
        totalPages: 3,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("dispatches the static route and serializes the paginated response", async () => {
    const response = await request(app.getHttpServer())
      .get("/attendance/class-options")
      .set("x-campus-id", CAMPUS_A_ID)
      .query({ search: "Sunflower", limit: 2, offset: 1, sort: "name" })
      .expect(200);

    expect(getAttendanceByIdUseCase.execute).not.toHaveBeenCalled();
    expect(getAttendanceClassOptionsUseCase.execute).toHaveBeenCalledWith({
      campusId: CAMPUS_A_ID,
      search: "Sunflower",
      limit: 2,
      offset: 1,
    });
    expect(response.body).toEqual({
      success: true,
      message: "Attendance class options retrieved successfully",
      data: [{ id: CLASS_ID, name: "Sunflower A", code: null }],
      pagination: {
        limit: 2,
        offset: 1,
        total: 5,
        totalPages: 3,
      },
      timestamp: expect.any(String),
    });
  });

  it("denies users without an attendance permission", async () => {
    currentUser = buildUser(CAMPUS_A_ID, ["student.read"]);

    await request(app.getHttpServer())
      .get("/attendance/class-options")
      .set("x-campus-id", CAMPUS_A_ID)
      .expect(403);

    expect(getAttendanceClassOptionsUseCase.execute).not.toHaveBeenCalled();
  });

  it("rejects a campus where the user has no active staff profile", async () => {
    await request(app.getHttpServer())
      .get("/attendance/class-options")
      .set("x-campus-id", CAMPUS_B_ID)
      .expect(403);

    expect(getAttendanceClassOptionsUseCase.execute).not.toHaveBeenCalled();
  });
});
