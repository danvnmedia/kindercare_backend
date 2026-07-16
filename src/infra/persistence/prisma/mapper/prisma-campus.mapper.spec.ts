import { Campus as PrismaCampus } from "@prisma/client";
import { PrismaCampusMapper } from "./prisma-campus.mapper";

describe("PrismaCampusMapper", () => {
  const row: PrismaCampus = {
    id: "11111111-1111-4111-a111-111111111111",
    name: "Main Campus",
    address: "123 Main Street",
    phoneNumber: "+84901234567",
    timeZone: "America/Toronto",
    isArchived: false,
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    updatedAt: new Date("2026-07-14T01:00:00.000Z"),
  };

  it("round-trips the campus timezone", () => {
    const campus = PrismaCampusMapper.toDomain(row);

    expect(campus.timeZone).toBe("America/Toronto");
    expect(PrismaCampusMapper.toPrisma(campus).timeZone).toBe(
      "America/Toronto",
    );
    expect(PrismaCampusMapper.toPrismaUpdate(campus).timeZone).toBe(
      "America/Toronto",
    );
  });
});
