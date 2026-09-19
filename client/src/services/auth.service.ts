import { apiPost, tokenStore } from './api';
import { TokenPair } from '../types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export async function login(input: LoginInput): Promise<TokenPair> {
  const tokens = await apiPost<TokenPair>('/auth/login', input);
  tokenStore.setAccessToken(tokens.accessToken);
  tokenStore.setRefreshToken(tokens.refreshToken);
  return tokens;
}

export async function signUp(input: SignUpInput): Promise<{ userId: string }> {
  return apiPost<{ userId: string }>('/auth/signup', input);
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStore.getRefreshToken();
  if (refreshToken) {
    await apiPost('/auth/logout', { refreshToken }).catch(() => {/* best-effort */});
  }
  tokenStore.clear();
}
