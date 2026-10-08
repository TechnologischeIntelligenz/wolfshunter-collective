const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(?:sk|shpat|shpca|shpss|shppa)_[A-Za-z0-9_-]{12,}\b/gi,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\b[a-f0-9]{32,}\b/gi,
] as const;

const isControlCharacter = (character: string) => {
  const codePoint = character.codePointAt(0);
  return typeof codePoint === "number" && (codePoint < 32 || codePoint === 127);
};

const stripControlCharacters = (value: string) =>
  [...value].map((character) => (isControlCharacter(character) ? " " : character)).join("");

export function sanitizeSupportMessage(value: string) {
  let sanitized = stripControlCharacters(value);
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[secret redacted]");
  }

  return sanitized
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}
