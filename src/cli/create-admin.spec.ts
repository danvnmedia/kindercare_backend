import { Readable } from "node:stream";

import { parseArgs, readPasswordFromStdin } from "./create-admin";

describe("admin CLI password input", () => {
  it("rejects plaintext passwords in process arguments", () => {
    expect(() =>
      parseArgs([
        "update-password",
        "--email=admin@example.com",
        "--password=Secret123!",
      ]),
    ).toThrow(
      "Plaintext password arguments are not supported; use --password-stdin",
    );
  });

  it("recognizes secure stdin password input", () => {
    expect(
      parseArgs([
        "update-password",
        "--email=admin@example.com",
        "--password-stdin",
      ]),
    ).toEqual({
      command: "update-password",
      email: "admin@example.com",
      passwordStdin: true,
    });
  });

  it("reads the password from stdin without retaining the trailing newline", async () => {
    const input = Readable.from(["Secret", "123!\n"]);

    await expect(readPasswordFromStdin(input)).resolves.toBe("Secret123!");
  });

  it("rejects empty or undersized stdin values", async () => {
    const input = Readable.from(["short\n"]);

    await expect(readPasswordFromStdin(input)).rejects.toThrow(
      "Password from stdin must contain at least 8 characters",
    );
  });
});
