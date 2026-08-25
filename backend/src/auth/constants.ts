export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is missing in production!',
      );
    }
    return 'development_only_jwt_secret_key_123456789';
  }
  return secret;
}

export const jwtConstants = {
  get secret() {
    return getJwtSecret();
  },
};
