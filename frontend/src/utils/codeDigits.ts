export function extractCodeDigits(text: string): string {
  return text.match(/(?<!\d)\d{6}(?!\d)/)?.[0] ?? text.replace(/\D/g, '');
}
