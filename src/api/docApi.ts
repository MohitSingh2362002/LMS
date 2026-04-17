const WHITEBOARD_SERVER_URL = import.meta.env.VITE_WHITEBOARD_SOCKET_URL || 'http://localhost:3001';

interface UploadDocResponse {
  url: string;
  title: string;
}

export async function uploadSessionDoc(file: File): Promise<UploadDocResponse> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${WHITEBOARD_SERVER_URL}/docs/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error('Failed to upload document. Please try a smaller file or another format.');
  }

  const data = (await response.json()) as UploadDocResponse;
  return data;
}
