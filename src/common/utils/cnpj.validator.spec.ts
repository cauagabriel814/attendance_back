import { validateCnpj } from './cnpj.validator';

describe('validateCnpj', () => {
  // CNPJs válidos (gerados pelo algoritmo oficial)
  it.each([
    ['11222333000181'],
    ['45997418000153'],
    ['12345678000195'],
  ])('deve aceitar CNPJ válido: %s', (cnpj) => {
    expect(validateCnpj(cnpj)).toBe(true);
  });

  // CNPJs inválidos
  it.each([
    ['00000000000000'],  // todos zeros
    ['11111111111111'],  // todos iguais
    ['1234567800019'],   // menos de 14 dígitos
    ['123456780001950'], // mais de 14 dígitos
    ['12345678000196'],  // dígito verificador errado
    [''],
  ])('deve rejeitar CNPJ inválido: "%s"', (cnpj) => {
    expect(validateCnpj(cnpj)).toBe(false);
  });
});
