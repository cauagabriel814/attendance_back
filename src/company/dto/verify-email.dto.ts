import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ example: 'uuid-do-token-de-verificacao' })
  @IsUUID('4', { message: 'Token de verificação inválido' })
  token: string;
}
