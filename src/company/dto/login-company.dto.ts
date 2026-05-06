import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginCompanyDto {
  @ApiProperty({ example: 'empresa@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SenhaForte@123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
