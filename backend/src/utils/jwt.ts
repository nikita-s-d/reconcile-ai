import jwt from 'jsonwebtoken';
import { UserPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'reconcile_ai_super_secret_jwt_key_2026_hackathon';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export const signToken = (payload: UserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
};

export const verifyToken = (token: string): UserPayload => {
  return jwt.verify(token, JWT_SECRET) as UserPayload;
};
