import { Request } from 'express';
import { JwtPayload } from '../types/jwt-payload.type';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
