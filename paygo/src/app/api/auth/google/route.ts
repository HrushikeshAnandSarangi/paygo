import { authGoogle } from '../../../../lib/emailApiRoutes';
export async function POST(req: Request) {
  return authGoogle(req as any);
}