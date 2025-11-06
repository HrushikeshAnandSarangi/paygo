import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let app: admin.app.App;

if (!admin.apps.length) {
  // Option 1: Use service account JSON file
  // Download from Firebase Console > Project Settings > Service Accounts
  // const serviceAccount = require('../../firebase-service-account.json');
  
  // Option 2: Use environment variables (RECOMMENDED for production)
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
} else {
  app = admin.app();
}

const bucket = admin.storage().bucket();

/**
 * Upload a file to Firebase Storage using Admin SDK
 * @param buffer - File buffer to upload
 * @param path - Storage path (e.g., 'attachments/userId/messageId/filename.jpg')
 * @param metadata - Optional metadata (contentType, etc.)
 * @returns Public download URL
 */
export async function uploadFileAdmin(
  buffer: Buffer,
  path: string,
  metadata?: {
    contentType?: string;
    [key: string]: any;
  }
): Promise<string> {
  try {
    console.log(`[Firebase Admin] Uploading to: ${path}`);

    const file = bucket.file(path);

    // Upload the buffer
    await file.save(buffer, {
      metadata: {
        contentType: metadata?.contentType || 'application/octet-stream',
        ...metadata,
      },
      public: false, // Set to true if you want public access without signed URLs
    });

    console.log(`[Firebase Admin] File uploaded successfully: ${path}`);

    // Make the file publicly accessible (optional - or use signed URLs)
    await file.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
    
    console.log(`[Firebase Admin] Public URL: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error(`[Firebase Admin] Upload failed for ${path}:`, error);
    throw new Error(`Admin SDK upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Alternative: Get a signed URL (temporary access) instead of making files public
 */
export async function uploadFileWithSignedUrl(
  buffer: Buffer,
  path: string,
  metadata?: { contentType?: string; [key: string]: any },
  expiresInDays: number = 7
): Promise<string> {
  try {
    console.log(`[Firebase Admin] Uploading to: ${path}`);

    const file = bucket.file(path);

    await file.save(buffer, {
      metadata: {
        contentType: metadata?.contentType || 'application/octet-stream',
        ...metadata,
      },
    });

    console.log(`[Firebase Admin] File uploaded, generating signed URL...`);

    // Generate a signed URL that expires in X days
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    });

    console.log(`[Firebase Admin] Signed URL generated (expires in ${expiresInDays} days)`);

    return signedUrl;
  } catch (error) {
    console.error(`[Firebase Admin] Upload failed for ${path}:`, error);
    throw new Error(`Admin SDK upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { admin, bucket };
