import { markEmailAsRead } from '../../../../../lib/emailApiRoutes';

export async function POST(
  req: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return markEmailAsRead(req as any, { params: resolvedParams });
}