import { instanceToPlain, plainToInstance } from "class-transformer";
import { DECORATORS } from "@nestjs/swagger";
import { AuthMeResponse } from "./auth-me.response";

describe("AuthMeResponse", () => {
  it("exposes profiles[] and omits the legacy profile field", () => {
    const response = plainToInstance(
      AuthMeResponse,
      {
        id: "user-1",
        clerkUid: "user_clerk123",
        isActive: true,
        roleAssignments: [],
        profile: {
          type: "staff",
          id: "legacy-profile",
          campusId: "campus-legacy",
          fullName: "Legacy Profile",
        },
        profiles: [
          {
            type: "staff",
            id: "staff-1",
            campusId: "campus-a",
            fullName: "Staff One",
            email: "staff@example.com",
            phoneNumber: "+15550000001",
            dateOfBirth: null,
            gender: null,
          },
          {
            type: "guardian",
            id: "guardian-1",
            campusId: "campus-b",
            fullName: "Guardian One",
            email: "guardian@example.com",
            phoneNumber: "+15550000002",
            dateOfBirth: "1985-03-20T00:00:00.000Z",
            gender: "FEMALE",
          },
        ],
        createdAt: "2024-11-14T10:30:00.000Z",
        updatedAt: "2024-11-14T15:45:00.000Z",
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      },
    );

    const plain = instanceToPlain(response);

    expect(plain).not.toHaveProperty("profile");
    expect(plain).toEqual({
      id: "user-1",
      clerkUid: "user_clerk123",
      isActive: true,
      roleAssignments: [],
      profiles: [
        {
          type: "staff",
          id: "staff-1",
          campusId: "campus-a",
          fullName: "Staff One",
          email: "staff@example.com",
          phoneNumber: "+15550000001",
          dateOfBirth: null,
          gender: null,
        },
        {
          type: "guardian",
          id: "guardian-1",
          campusId: "campus-b",
          fullName: "Guardian One",
          email: "guardian@example.com",
          phoneNumber: "+15550000002",
          dateOfBirth: "1985-03-20T00:00:00.000Z",
          gender: "FEMALE",
        },
      ],
      createdAt: new Date("2024-11-14T10:30:00.000Z"),
      updatedAt: new Date("2024-11-14T15:45:00.000Z"),
    });
  });

  it("documents profiles[] in Swagger metadata without legacy profile", () => {
    const properties = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES_ARRAY,
      AuthMeResponse.prototype,
    );
    const profilesMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      AuthMeResponse.prototype,
      "profiles",
    );

    expect(properties).toContain(":profiles");
    expect(properties).not.toContain(":profile");
    expect(profilesMetadata).toEqual(
      expect.objectContaining({
        description:
          "Active user profile information from Guardian and Staff rows",
      }),
    );
  });
});
