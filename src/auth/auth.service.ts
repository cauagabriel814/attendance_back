import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { JwtPayload } from './strategies/access-token.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Gera access + refresh token para um usuário */
  async generateTokens(payload: JwtPayload): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as any,
      }),
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any,
      }),
    ]);

    // Armazena o hash do refresh token (nunca o token raw)
    await this.saveRefreshToken(payload.sub, payload.type, refreshToken);

    return { accessToken, refreshToken };
  }

  /** Salva (ou rotaciona) o refresh token no banco como hash SHA-256 */
  private async saveRefreshToken(
    userId: string,
    userType: 'employee' | 'company',
    rawToken: string,
  ) {
    const tokenHash = this.crypto.sha256(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Revoga tokens anteriores do usuário (rotação)
    await this.prisma.refreshToken.updateMany({
      where: { userId, userType: userType === 'company' ? 'COMPANY' : 'EMPLOYEE', revoked: false },
      data: { revoked: true },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        userType: userType === 'company' ? 'COMPANY' : 'EMPLOYEE',
        tokenHash,
        expiresAt,
      },
    });
  }

  /** Valida e rotaciona o refresh token */
  async refreshTokens(
    userId: string,
    userType: 'employee' | 'company',
    rawRefreshToken: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.crypto.sha256(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        userType: userType === 'company' ? 'COMPANY' : 'EMPLOYEE',
        tokenHash,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    return this.generateTokens({ sub: userId, type: userType, email });
  }

  /** Revoga todos os refresh tokens do usuário (logout) */
  async revokeAllTokens(userId: string, userType: 'employee' | 'company') {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        userType: userType === 'company' ? 'COMPANY' : 'EMPLOYEE',
        revoked: false,
      },
      data: { revoked: true },
    });
  }
}
