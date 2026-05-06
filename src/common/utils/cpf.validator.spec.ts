import { validateCpf } from './cpf.validator';

describe('validateCpf', () => {
  it.each([
    ['12345678909'],
    ['52998224725'],
    ['11144477735'],
  ])('deve aceitar CPF válido: %s', (cpf) => {
    expect(validateCpf(cpf)).toBe(true);
  });

  it.each([
    ['00000000000'],
    ['11111111111'],
    ['1234567890'],  // 10 dígitos
    ['123456789099'], // 12 dígitos
    ['12345678900'],  // dígito errado
    [''],
  ])('deve rejeitar CPF inválido: "%s"', (cpf) => {
    expect(validateCpf(cpf)).toBe(false);
  });
});
