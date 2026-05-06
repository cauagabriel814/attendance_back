import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: 'empresa@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty({ message: 'Nome do dono é obrigatório' })
  ownerName: string;

  @ApiProperty({ example: '12.345.678/0001-95', description: 'CNPJ com ou sem formatação' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, { message: 'Formato de CNPJ inválido' })
  cnpj: string;

  @ApiProperty({ example: '1980-05-15', description: 'Data de nascimento do dono (ISO 8601)' })
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  ownerBirthDate: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  allowOvertime: boolean;

  @ApiPropertyOptional({ example: 2.5, description: 'Horas extras máximas permitidas por dia' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(4)
  maxOvertimeHours?: number;

  @ApiProperty({ example: 50, description: 'Quantidade máxima de funcionários' })
  @IsInt()
  @Min(1)
  maxEmployees: number;

  @ApiProperty({ example: 'SenhaForte@123' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  password: string;
}
