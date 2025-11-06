import { getEmails } from '../../../lib/emailApiRoutes';

export async function GET(req: Request) {
  return getEmails(req as any);
}