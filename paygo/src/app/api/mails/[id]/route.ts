import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { MailSchema, ProfileDocument } from '@/lib/schemas';
import { z } from 'zod';
import { UpdateFilter, Collection } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const collection = db.collection('mails');
    const mail = await collection.findOne({ uuid: id });
    if (!mail) {
      return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
    }
    return NextResponse.json(mail);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch mail' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = MailSchema.partial().parse(body);
    const db = await getDb();
    const collection = db.collection('mails');
    const result = await collection.updateOne(
      { uuid: id },
      { $set: validated }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
    }
    const updated = await collection.findOne({ uuid: id });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.cause }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update mail' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const mailCollection = db.collection('mails');
    const profileCollection: Collection<ProfileDocument> = db.collection<ProfileDocument>('profiles');
    const mail = await mailCollection.findOne({ uuid: id });
    if (!mail) {
      return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
    }
    // Typed update: TS now knows scanned is string[], so { scanned: string } is valid for $pull
    const pullUpdate: UpdateFilter<ProfileDocument> = {
      $pull: { scanned: id }
    };
    await profileCollection.updateMany(
      { scanned: id }, // Filter: profiles containing this mail UUID in scanned
      pullUpdate
    );
    const result = await mailCollection.deleteOne({ uuid: id });
    return NextResponse.json({ message: 'Mail deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete mail' }, { status: 500 });
  }
}