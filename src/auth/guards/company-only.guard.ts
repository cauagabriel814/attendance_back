import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../strategies/access-token.strategy';

/**
 * Guard que garante que apenas tokens do tipo 'company' acessem o endpoint.
 * Use após o AccessTokenGuard.
 */
@Injectable()
export class CompanyOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user || user.type !== 'company') {
      throw new ForbiddenException('Acesso restrito a administradores de empresa');
    }
    return true;
  }
}
