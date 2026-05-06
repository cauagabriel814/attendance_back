/**
 * Valida CPF pelo algoritmo oficial da Receita Federal.
 * Recebe o CPF apenas com dígitos (11 chars).
 */
export function validateCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false; // Rejeita todos iguais (111.111.111-11)

  const calcDigit = (cpf: string, length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += parseInt(cpf.charAt(i)) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 || remainder === 11 ? 0 : remainder;
  };

  const first = calcDigit(cpf, 9);
  if (first !== parseInt(cpf.charAt(9))) return false;

  const second = calcDigit(cpf, 10);
  if (second !== parseInt(cpf.charAt(10))) return false;

  return true;
}
