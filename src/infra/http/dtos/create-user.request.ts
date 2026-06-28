import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class CreateUserRequest {
  @ApiProperty({ example: "John Doe", description: "User name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "john@example.com", description: "User email" })
  @IsEmail()
  email: string;
}
