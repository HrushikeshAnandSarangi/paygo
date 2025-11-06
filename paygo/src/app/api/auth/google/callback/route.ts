import { authGoogleCallback } from '../../../../../lib/emailApiRoutes';
export async function GET(req: Request) {
  return authGoogleCallback(req as any);
}