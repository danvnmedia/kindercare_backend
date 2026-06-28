import "reflect-metadata";
import { CanActivate, UseGuards } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import {
  REQUIRE_CAMPUS_ACCESS_KEY,
  RequireCampusAccess,
} from "./require-campus-access.decorator";
import { CampusGuard } from "../guards/campus.guard";

class LaterGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe("RequireCampusAccess", () => {
  it("places CampusGuard before later method guards", () => {
    class TestController {
      @RequireCampusAccess()
      @UseGuards(LaterGuard)
      handler() {
        return undefined;
      }
    }

    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      TestController.prototype.handler,
    );

    expect(guards).toEqual([CampusGuard, LaterGuard]);
  });

  it("stores campus access options metadata", () => {
    class TestController {
      @RequireCampusAccess({ required: false, allowGlobalAdmin: false })
      handler() {
        return undefined;
      }
    }

    const options = Reflect.getMetadata(
      REQUIRE_CAMPUS_ACCESS_KEY,
      TestController.prototype.handler,
    );

    expect(options).toEqual({ required: false, allowGlobalAdmin: false });
  });
});
