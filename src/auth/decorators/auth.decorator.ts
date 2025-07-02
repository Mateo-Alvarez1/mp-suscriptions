import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ValidRoles } from "src/interfaces/valid-roles.interfaces";
import { RoleProtected } from "./role-protected.decorator";
import { UserRoleGuard } from "../guards/use-role.guard";

export function Auth(...roles: ValidRoles[]) {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(AuthGuard(), UserRoleGuard)
  );
}
