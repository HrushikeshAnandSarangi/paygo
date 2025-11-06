import { ref, uploadBytes, getDownloadURL, UploadMetadata } from 'firebase/storage';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);
const auth = getAuth(app);

export { app, storage, auth };

export async function uploadFile(
  file: File | Buffer,
  path: string,
  metadata?: UploadMetadata
): Promise<string> {
  // Create a storage reference
  const storageRef = ref(storage, path);

  try {
    // Upload the file or buffer
    console.log(`Uploading file to: ${path}`);

    // Pass metadata to uploadBytes, which is crucial for Buffers
    const snapshot = await uploadBytes(storageRef, file, metadata);

    console.log('File uploaded successfully!');

    // Get the public download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('File available at:', downloadURL);

    return downloadURL;

  } catch (error) {
    console.error(`Error uploading file ${path}:`, error);
    // Throw a more specific error
    throw new Error(`File upload failed for ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}