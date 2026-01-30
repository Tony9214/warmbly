export function isStrongPassword(password: string): boolean {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber
  );
}

const ACCESS_TOKEN = "access_token"
const ACCESS_TOKEN_EXPIRATION = "access_token_expires_at"
const REFRESH_TOKEN = "refresh_token"
const REFRESH_TOKEN_EXPIRATION = "refresh_token_expires_at"

export const TOKENS = [
  ACCESS_TOKEN, ACCESS_TOKEN_EXPIRATION, REFRESH_TOKEN, REFRESH_TOKEN_EXPIRATION
]

export const saveTokens = (data: Record<string, string>) => {
  TOKENS.forEach((k) => localStorage.setItem(k, data[k]))
}