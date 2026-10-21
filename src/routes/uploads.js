import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPublicDir } from '../core/config.js';
import { appendEvent } from '../core/store.js';
import { readBody, sendJson } from '../core/http.js';

const editorUploadMaxBytes = 8 * 1024 * 1024;
const editorUploadBodyMaxBytes = 12 * 1024 * 1024;
const editorUploadTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

function editorUploadExtension(mimeType) {
  return editorUploadTypes.get(String(mimeType || '').toLowerCase()) || '';
}

async function handleEditorImageUpload(request, response) {
  const body = await readBody(request, { maxBytes: editorUploadBodyMaxBytes });
  const dataUrl = String(body.data || '');
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([\s\S]+)$/i);
  if (!match) {
    sendJson(response, 400, { error: 'Нужен файл изображения JPG, PNG, WebP или GIF.' });
    return true;
  }

  const mimeType = match[1].toLowerCase();
  const extension = editorUploadExtension(mimeType);
  const base64 = match[2].replace(/\s+/g, '');
  if (!extension || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
    sendJson(response, 400, { error: 'Некорректный файл изображения.' });
    return true;
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    sendJson(response, 400, { error: 'Пустой файл изображения.' });
    return true;
  }
  if (buffer.length > editorUploadMaxBytes) {
    sendJson(response, 413, { error: 'Фото слишком большое. Максимум 8 МБ.' });
    return true;
  }

  const uploadDir = path.join(getPublicDir(), 'uploads', 'editor');
  await mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  await writeFile(path.join(uploadDir, fileName), buffer);

  const url = `/uploads/editor/${fileName}`;
  await appendEvent('editor.image_uploaded', {
    url,
    name: String(body.name || 'image').slice(0, 140),
    size: buffer.length,
    type: mimeType
  });
  sendJson(response, 201, { url, name: body.name || fileName, size: buffer.length, type: mimeType });
  return true;
}

export async function handleUploadsApi({ request, response, method, pathname }) {
  if (method === 'POST' && pathname === '/api/uploads/images') {
    return handleEditorImageUpload(request, response);
  }
  return false;
}
