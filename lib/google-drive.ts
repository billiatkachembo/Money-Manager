import * as SecureStore from 'expo-secure-store';

export interface DriveAuthState {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
}

const ACCESS_TOKEN_KEY = 'googleDriveAccessToken';
const REFRESH_TOKEN_KEY = 'googleDriveRefreshToken';
const EXPIRES_AT_KEY = 'googleDriveAccessTokenExpiresAt';
const FOLDER_ID_KEY = 'googleDriveFolderId';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export async function loadDriveAuth(): Promise<DriveAuthState | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    return null;
  }
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  const expiresAtRaw = await SecureStore.getItemAsync(EXPIRES_AT_KEY);
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : undefined;
  return {
    accessToken,
    refreshToken: refreshToken || undefined,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
  };
}

export async function saveDriveAuth(state: DriveAuthState, expiresIn?: number): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, state.accessToken);

  if (state.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, state.refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }

  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    const expiresAt = Date.now() + expiresIn * 1000;
    await SecureStore.setItemAsync(EXPIRES_AT_KEY, String(expiresAt));
  } else {
    await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
  }
}

export async function clearDriveAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
  await SecureStore.deleteItemAsync(FOLDER_ID_KEY);
}

export function isTokenValid(state: DriveAuthState | null): boolean {
  if (!state?.accessToken) {
    return false;
  }
  if (!state.expiresAt) {
    return true;
  }
  return state.expiresAt - Date.now() > 60_000;
}

export async function refreshAccessToken(refreshToken: string, clientId: string) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message = (payload?.error_description as string | undefined) ?? (payload?.error as string | undefined) ?? 'Unable to refresh Google session.';
    throw new Error(message);
  }

  return {
    accessToken: payload.access_token as string,
    expiresIn: payload.expires_in as number | undefined,
  };
}

async function driveFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorData = data as Record<string, unknown>;
    const message = typeof data === 'string'
      ? data
      : (errorData?.error as Record<string, unknown>)?.message ?? 'Google Drive request failed.';
    throw new Error(String(message));
  }

  return data as T;
}

async function findFolder(accessToken: string, name: string): Promise<DriveFile | null> {
  const query = `mimeType='${DRIVE_FOLDER_MIME}' and name='${name}' and trashed=false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)`;
  const result = await driveFetch<{ files?: DriveFile[] }>(url, accessToken);
  return result.files?.[0] ?? null;
}

async function createFolder(accessToken: string, name: string): Promise<DriveFile> {
  const payload = {
    name,
    mimeType: DRIVE_FOLDER_MIME,
  };

  return driveFetch<DriveFile>(`${DRIVE_API_BASE}/files`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getOrCreateBackupFolder(accessToken: string, name: string): Promise<string> {
  const storedId = await SecureStore.getItemAsync(FOLDER_ID_KEY);
  if (storedId) {
    return storedId;
  }

  const existing = await findFolder(accessToken, name);
  if (existing?.id) {
    await SecureStore.setItemAsync(FOLDER_ID_KEY, existing.id);
    return existing.id;
  }

  const created = await createFolder(accessToken, name);
  await SecureStore.setItemAsync(FOLDER_ID_KEY, created.id);
  return created.id;
}

export async function uploadBackupFile(
  accessToken: string,
  name: string,
  content: string,
  folderId?: string
): Promise<DriveFile> {
  const metadata = {
    name,
    mimeType: 'application/json',
    parents: folderId ? [folderId] : undefined,
  };

  const boundary = 'moneymanager-drive-boundary';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--`;

  return driveFetch<DriveFile>(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime`,
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
}

export async function listBackupFiles(accessToken: string, folderId?: string): Promise<DriveFile[]> {
  const baseQuery = "mimeType='application/json' and trashed=false and name contains 'money-manager-drive-backup'";
  const query = folderId ? `${baseQuery} and '${folderId}' in parents` : baseQuery;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)`;
  const result = await driveFetch<{ files?: DriveFile[] }>(url, accessToken);
  return result.files ?? [];
}

export async function downloadBackupFile(accessToken: string, fileId: string): Promise<string> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
  return driveFetch<string>(url, accessToken, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
}
