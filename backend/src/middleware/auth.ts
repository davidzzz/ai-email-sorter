import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include session
declare module 'express' {
  interface Request {
    session: {
      userId?: string;
    };
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};