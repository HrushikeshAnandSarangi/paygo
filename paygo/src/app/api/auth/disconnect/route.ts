import { authDisconnect } from '../../../../lib/emailApiRoutes';
export async function POST(req: Request) {
  return authDisconnect(req as any);
}