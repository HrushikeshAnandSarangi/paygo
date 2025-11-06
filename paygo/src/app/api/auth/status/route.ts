import { authStatus } from '../../../../lib/emailApiRoutes';
export async function GET(req: Request) {
  return authStatus(req as any);
}