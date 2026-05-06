import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsDateString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Maria Souza' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123.456.789-09', description: 'CPF com ou sem formatação' })
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'Formato de CPF inválido' })
  cpf: string;

  @ApiProperty({ example: '1990-03-20' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: 'uuid-do-cargo' })
  @IsUUID('4')
  roleId: string;

  @ApiProperty({ example: '08:00', description: 'Horário de entrada no formato HH:MM' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário de entrada inválido (use HH:MM)' })
  entryTime: string;

  @ApiProperty({ example: '17:00', description: 'Horário de saída no formato HH:MM' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário de saída inválido (use HH:MM)' })
  exitTime: string;

  @ApiProperty({ example: false, description: 'Permite tolerância de atraso?' })
  @IsBoolean()
  lateToleranceAllowed: boolean;

  @ApiProperty({ example: false, description: 'Permite horas extras?' })
  @IsBoolean()
  overtimeAllowed: boolean;

  @ApiProperty({ example: 'SenhaTemp@123' })
  @IsString()
  @MinLength(8)
  password: string;
}
