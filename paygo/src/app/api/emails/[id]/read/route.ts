import { markEmailAsRead } from '../../../../../lib/emailApiRoutes';
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return markEmailAsRead(req as any, { params });
}