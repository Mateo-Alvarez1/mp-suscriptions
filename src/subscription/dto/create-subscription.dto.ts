import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateSubscriptionDto {
  @IsEmail()
  email: string;

  @IsUUID()
  planId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  backUrl?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
