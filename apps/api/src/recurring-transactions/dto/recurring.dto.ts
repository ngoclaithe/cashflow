import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { TransactionDirection } from '@prisma/client';

export class CreateRecurringDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @IsEnum(TransactionDirection)
  @IsOptional()
  direction?: TransactionDirection;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth!: number;

  @IsString()
  @IsOptional()
  dueDateDescription?: string;

  @IsBoolean()
  @IsOptional()
  isObligation?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRecurringDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsEnum(TransactionDirection)
  @IsOptional()
  direction?: TransactionDirection;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  dayOfMonth?: number;

  @IsString()
  @IsOptional()
  dueDateDescription?: string;

  @IsBoolean()
  @IsOptional()
  isObligation?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
