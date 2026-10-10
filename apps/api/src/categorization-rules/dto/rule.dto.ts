import { IsNotEmpty, IsOptional, IsString, IsEnum, IsInt, IsBoolean } from 'class-validator';
import { RuleField, RuleOperator } from '@prisma/client';

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsEnum(RuleField)
  @IsNotEmpty()
  field!: RuleField;

  @IsEnum(RuleOperator)
  @IsNotEmpty()
  operator!: RuleOperator;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsEnum(RuleField)
  @IsOptional()
  field?: RuleField;

  @IsEnum(RuleOperator)
  @IsOptional()
  operator?: RuleOperator;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
