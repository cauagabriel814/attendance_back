import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  const ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 chars

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptoService],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // ─── encryptCpf / decryptCpf ──────────────────────────────────────────────

  it('deve criptografar e descriptografar CPF corretamente', () => {
    const cpf = '12345678909';
    const encrypted = service.encryptCpf(cpf);

    expect(encrypted).not.toBe(cpf);
    expect(encrypted).toContain(':'); // formato "iv:ciphertext"

    const decrypted = service.decryptCpf(encrypted);
    expect(decrypted).toBe(cpf);
  });

  it('deve aceitar CPF formatado (com pontos e traço) e retornar apenas dígitos', () => {
    const cpfFormatado = '123.456.789-09';
    const encrypted = service.encryptCpf(cpfFormatado);
    const decrypted = service.decryptCpf(encrypted);
    expect(decrypted).toBe('12345678909'); // sem formatação
  });

  it('deve gerar IV diferente a cada criptografia (valores diferentes)', () => {
    const cpf = '12345678909';
    const enc1 = service.encryptCpf(cpf);
    const enc2 = service.encryptCpf(cpf);
    expect(enc1).not.toBe(enc2); // IV aleatório garante isso
  });

  it('deve lançar erro ao descriptografar formato inválido', () => {
    expect(() => service.decryptCpf('invalido_sem_dois_pontos')).toThrow();
  });

  // ─── maskCpf ─────────────────────────────────────────────────────────────

  it('deve mascarar CPF de 11 dígitos corretamente', () => {
    const masked = service.maskCpf('12345678909');
    expect(masked).toMatch(/^\*{3}\.\*{3}\d{3}-\*{2}$/);
    expect(masked).toBe('***.***789-**');
  });

  it('deve retornar máscara padrão para CPF inválido', () => {
    const masked = service.maskCpf('123');
    expect(masked).toBe('***.***.***-**');
  });

  // ─── sha256 ───────────────────────────────────────────────────────────────

  it('deve gerar hash SHA-256 determinístico', () => {
    const hash1 = service.sha256('valor_teste');
    const hash2 = service.sha256('valor_teste');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('deve gerar hashes diferentes para entradas diferentes', () => {
    const h1 = service.sha256('aaa');
    const h2 = service.sha256('bbb');
    expect(h1).not.toBe(h2);
  });

  // ─── generateUuidToken ────────────────────────────────────────────────────

  it('deve gerar UUID v4 válido', () => {
    const uuid = service.generateUuidToken();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('deve gerar UUIDs únicos', () => {
    const u1 = service.generateUuidToken();
    const u2 = service.generateUuidToken();
    expect(u1).not.toBe(u2);
  });
});
