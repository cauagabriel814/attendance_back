import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Serviço de criptografia para dados sensíveis (LGPD).
 *
 * CPF → AES-256-CBC (reversível, necessário para exibição ao próprio titular)
 * CNPJ → SHA-256 (hash irreversível, apenas para unicidade e busca)
 * Senhas → bcrypt (via bcrypt library, não aqui)
 * Refresh tokens → SHA-256 (nunca armazenar o token raw)
 */
@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly ivLength = 16;

  private getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 32) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY deve ter exatamente 32 caracteres',
      );
    }
    return Buffer.from(key, 'utf-8');
  }

  /**
   * Criptografa o CPF usando AES-256-CBC.
   * Retorna "iv:ciphertext" em hex.
   */
  encryptCpf(cpf: string): string {
    // Remove formatação (somente dígitos)
    const cleanCpf = cpf.replace(/\D/g, '');
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(cleanCpf, 'utf-8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Descriptografa o CPF.
   * Entrada: "iv:ciphertext" em hex.
   */
  decryptCpf(encryptedCpf: string): string {
    const [ivHex, encryptedHex] = encryptedCpf.split(':');
    if (!ivHex || !encryptedHex) {
      throw new InternalServerErrorException('Formato de CPF criptografado inválido');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  /**
   * Mascara CPF para exibição em listagens.
   * Ex: "12345678901" → "***.***.789-**"
   */
  maskCpf(cpf: string): string {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return '***.***.***-**';
    return `***.***${clean.slice(6, 9)}-**`;
  }

  /**
   * Hash SHA-256 para CNPJ (unicidade) e refresh tokens.
   */
  sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Gera um token UUID v4 seguro para verificação de e-mail.
   */
  generateUuidToken(): string {
    return crypto.randomUUID();
  }
}
