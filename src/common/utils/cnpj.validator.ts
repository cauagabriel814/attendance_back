/**
 * Valida CNPJ pelo algoritmo oficial da Receita Federal.
 * Recebe o CNPJ apenas com dígitos (14 chars).
 */
export function validateCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;

  // Rejeita CNPJs com todos os dígitos iguais (ex: 00000000000000)
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calcDigit = (cnpj: string, length: number): number => {
    let sum = 0;
    let pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(cnpj.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result;
  };

  const firstDigit = calcDigit(cnpj, 12);
  if (firstDigit !== parseInt(cnpj.charAt(12))) return false;

  const secondDigit = calcDigit(cnpj, 13);
  if (secondDigit !== parseInt(cnpj.charAt(13))) return false;

  return true;
}
