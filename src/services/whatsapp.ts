import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const token = process.env.WHATSAPP_TOKEN!;

const api = axios.create({
  baseURL: WHATSAPP_API_URL,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

export async function sendMessage(to: string, text: string): Promise<void> {
  await api.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  });
}

export async function sendReaction(to: string, messageId: string, emoji: string): Promise<void> {
  await api.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji,
    },
  });
}

export async function getMediaUrl(mediaId: string): Promise<string> {
  const response = await api.get(`/${mediaId}`);
  return response.data.url;
}

export async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  const response = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

export async function getMediaAsBase64(mediaId: string): Promise<{ base64: string; mimeType: string }> {
  // Obtener metadata del media
  const metaResponse = await api.get(`/${mediaId}`);
  const { url, mime_type } = metaResponse.data;

  // Descargar el archivo
  const buffer = await downloadMedia(url);

  return {
    base64: buffer.toString('base64'),
    mimeType: mime_type,
  };
}
