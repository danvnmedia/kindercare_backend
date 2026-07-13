import {
  GUARDIAN_FIXTURES,
  GUARDIAN_RELATIONSHIP_NAMES,
  GUARDIAN_STUDENT_LINKS,
} from "../../../../prisma/seeds/seed-guardians";
import { fixtureId } from "../../../../prisma/seeds/seed-support";
import {
  parseSeedStudents,
  readSeedStudents,
  STUDENT_LIFECYCLE_SCENARIOS,
} from "../../../../prisma/seeds/seed-students";

describe("optional development seed fixtures", () => {
  it("loads unique corrected student fixtures covering every lifecycle phase", () => {
    const students = readSeedStudents();

    expect(students).toHaveLength(66);
    expect(new Set(students.map(({ seedKey }) => seedKey)).size).toBe(
      students.length,
    );
    expect(students.some(({ fullName }) => fullName.includes("MALE"))).toBe(
      false,
    );
    expect(students.map(({ fullName }) => fullName)).toEqual(
      expect.arrayContaining(["Đỗ Nam Khánh", "Trần Nhất Nam"]),
    );
    expect(
      new Set(students.map(({ lifecycleScenario }) => lifecycleScenario)),
    ).toEqual(new Set(STUDENT_LIFECYCLE_SCENARIOS));
  });

  it("rejects duplicate immutable student seed keys before database writes", () => {
    const csv = [
      "seedKey,fullName,nickname,lifecycleScenario,isArchived,dateOfBirth,gender",
      "student-001,Student One,,WAITING,FALSE,1/1/2023,MALE",
      "student-001,Student Two,,ACTIVE,FALSE,2/2/2023,FEMALE",
    ].join("\n");

    expect(() => parseSeedStudents(csv, "test fixture")).toThrow(
      'Duplicate seedKey "student-001"',
    );
  });

  it("keeps fixture UUIDs stable and campus-specific", () => {
    const first = fixtureId(
      "11111111-1111-4111-8111-111111111111",
      "student",
      "student-001",
    );
    const repeated = fixtureId(
      "11111111-1111-4111-8111-111111111111",
      "student",
      "student-001",
    );
    const otherCampus = fixtureId(
      "22222222-2222-4222-8222-222222222222",
      "student",
      "student-001",
    );

    expect(first).toBe(repeated);
    expect(first).not.toBe(otherCampus);
  });

  it("defines the exact ordered guardian relationship and family fixtures", () => {
    expect(GUARDIAN_RELATIONSHIP_NAMES).toEqual([
      "Ông",
      "Bà",
      "Bố",
      "Mẹ",
      "Anh",
      "Chị",
      "Cô",
      "Dì",
      "Chú",
      "Bác",
    ]);
    expect(GUARDIAN_FIXTURES).toHaveLength(15);
    expect(GUARDIAN_STUDENT_LINKS).toHaveLength(21);
    expect(
      GUARDIAN_FIXTURES.every(({ email }) =>
        /^[^@]+\+clerk_test@example\.com$/.test(email),
      ),
    ).toBe(true);
    expect(new Set(GUARDIAN_FIXTURES.map(({ email }) => email)).size).toBe(15);
    expect(
      GUARDIAN_FIXTURES.every(({ phoneNumber }) =>
        /^\+155555501\d{2}$/.test(phoneNumber),
      ),
    ).toBe(true);
    expect(
      new Set(GUARDIAN_FIXTURES.map(({ phoneNumber }) => phoneNumber)).size,
    ).toBe(15);
    expect(
      GUARDIAN_FIXTURES.filter(({ isArchived }) => isArchived),
    ).toHaveLength(1);
  });
});
