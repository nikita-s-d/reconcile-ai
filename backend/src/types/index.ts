import { Request } from 'express';
import { Role } from '@prisma/client';

export interface UserPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}
