import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

export class CreateSavingsGoalDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsNotEmpty()
  targetAmount!: number;

  @IsDateString()
  @IsNotEmpty()
  targetDate!: string;

  @IsNumber()
  @IsOptional()
  currentAmount?: number;
}

export class UpdateSavingsGoalDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  targetAmount?: number;

  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @IsNumber()
  @IsOptional()
  currentAmount?: number;
}
