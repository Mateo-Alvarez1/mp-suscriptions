import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreatePlanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  @IsNumber()
  @Min(0)
  price: number;
}
