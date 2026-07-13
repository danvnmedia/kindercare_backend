import { validate } from "class-validator";

import { LinkGuardianStudentRequest } from "./guardian/link-guardian-student.request";
import { ReorderGuardianRelationshipTypesRequest } from "./guardian-relationship-type/reorder-guardian-relationship-types.request";
import { LinkStudentGuardianRequest } from "./student/link-student-guardian.request";
import { UpdateStudentGuardianRequest } from "./student/update-student-guardian.request";

const UUID_V4 = "123e4567-e89b-42d3-a456-426614174000";
const UUID_V5 = "94f8965a-3a57-5ed4-91a7-3f6e61c89610";
const INVALID_UUID = "not-a-uuid";

interface RequestContract {
  dto: object;
  uuidProperties: string[];
}

function buildRequestContracts(id: string): RequestContract[] {
  return [
    {
      dto: Object.assign(new LinkGuardianStudentRequest(), {
        studentId: id,
        relationshipId: id,
      }),
      uuidProperties: ["studentId", "relationshipId"],
    },
    {
      dto: Object.assign(new LinkStudentGuardianRequest(), {
        guardianId: id,
        relationshipId: id,
      }),
      uuidProperties: ["guardianId", "relationshipId"],
    },
    {
      dto: Object.assign(new UpdateStudentGuardianRequest(), {
        relationshipId: id,
      }),
      uuidProperties: ["relationshipId"],
    },
    {
      dto: Object.assign(new ReorderGuardianRelationshipTypesRequest(), {
        ids: [id],
      }),
      uuidProperties: ["ids"],
    },
  ];
}

describe("guardian-student UUID request contracts", () => {
  it.each([
    ["UUIDv4", UUID_V4],
    ["UUIDv5", UUID_V5],
  ])("accepts valid %s identifiers", async (_label, id) => {
    for (const { dto, uuidProperties } of buildRequestContracts(id)) {
      const errors = await validate(dto);
      const uuidErrors = errors.filter(({ property }) =>
        uuidProperties.includes(property),
      );

      expect(uuidErrors).toHaveLength(0);
    }
  });

  it("rejects malformed identifiers", async () => {
    for (const { dto, uuidProperties } of buildRequestContracts(INVALID_UUID)) {
      const errors = await validate(dto);

      for (const property of uuidProperties) {
        expect(errors.some((error) => error.property === property)).toBe(true);
      }
    }
  });
});
