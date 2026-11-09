import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Completa o app.json com valores de cada pessoa que compila o app.
 * APPLE_TEAM_ID: o time da sua conta Apple (fica no app/.env, fora do git).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  ios: { ...config.ios, appleTeamId: process.env.APPLE_TEAM_ID || undefined },
});
