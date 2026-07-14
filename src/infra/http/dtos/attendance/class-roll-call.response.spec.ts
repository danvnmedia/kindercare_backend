import { instanceToPlain, plainToInstance } from "class-transformer";
import { AttendanceChangeLogResponse } from "./class-roll-call.response";

describe("AttendanceChangeLogResponse", () => {
  it("serializes the actor summary", () => {
    const response = plainToInstance(
      AttendanceChangeLogResponse,
      {
        id: "log-1",
        changeType: "STATUS_CHANGED",
        previousValue: null,
        newValue: { status: "PRESENT" },
        actorId: "user-1",
        actor: {
          id: "user-1",
          displayName: "Teacher Nguyen",
          email: "teacher@example.com",
          secret: "must-not-leak",
        },
        note: null,
        createdAt: new Date("2026-07-06T02:30:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    expect(instanceToPlain(response)).toMatchObject({
      actorId: "user-1",
      actor: {
        id: "user-1",
        displayName: "Teacher Nguyen",
        email: "teacher@example.com",
      },
    });
    expect(instanceToPlain(response).actor).not.toHaveProperty("secret");
  });

  it("serializes an unresolved actor as null", () => {
    const response = plainToInstance(
      AttendanceChangeLogResponse,
      {
        id: "log-1",
        changeType: "STATUS_CHANGED",
        previousValue: null,
        newValue: null,
        actorId: "deleted-user",
        actor: null,
        note: null,
        createdAt: new Date("2026-07-06T02:30:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    expect(instanceToPlain(response)).toMatchObject({
      actorId: "deleted-user",
      actor: null,
    });
  });
});
