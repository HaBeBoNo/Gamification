/**
 * googleDocs.ts
 * Google Docs REST API helpers (v1).
 * Also uses the Drive API to list/search documents.
 */

import { getAuthHeader } from './googleAuth';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DOCS_API = 'https://docs.googleapis.com/v1/documents';

export interface GoogleDoc {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: { displayName: string }[];
  lastModifyingUser?: { displayName: string };
}

export type DocTemplateType =
  | 'blank'
  | 'meeting-notes'
  | 'contract'
  | 'press-release'
  | 'tour-rider';

const TEMPLATE_CONTENT: Record<DocTemplateType, string> = {
  'blank': '',
  'meeting-notes': '## Mötesanteckningar\n\nDatum: \nDeltagare: \n\n### Agenda\n\n1. \n\n### Beslut\n\n### Åtgärdspunkter\n\n| Vad | Vem | När |\n|-----|-----|-----|\n|     |     |     |',
  'contract': '## Spelningskontrakt\n\nDatum: \nArrangör: \nPlats: \nTid: \nArtist: Sektionen\n\n### Villkor\n\n- Arvode: \n- Teknikrider bifogas\n- Betalning senast: ',
  'press-release': '## Pressrelease\n\nFÖR OMEDELBAR PUBLICERING\n\n**Sektionen — [Rubrik]**\n\n[Ingresstext]\n\n### Om Sektionen\n\n[Bandbiografi]\n\n### Kontakt\n\nPresskontakt: ',
  'tour-rider': '## Tour Rider — Sektionen\n\n### Teknisk rider\n\n**PA-system:** \n**Monitors:** \n**Backline:** \n\n### Cateringrider\n\n**Dryck:**\n**Mat:**\n\n### Övernattning\n',
};

/**
 * List Google Docs accessible to the user.
 * Optionally filter by whether they are owned by the user.
 */
export async function listDocs(ownedByMe = false): Promise<GoogleDoc[]> {
  const q = ownedByMe
    ? `mimeType = 'application/vnd.google-apps.document' and trashed = false and 'me' in owners`
    : `mimeType = 'application/vnd.google-apps.document' and trashed = false`;

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,modifiedTime,webViewLink,owners,lastModifyingUser)',
    orderBy: 'modifiedTime desc',
    pageSize: '30',
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) throw new Error(`Docs listDocs failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.files ?? [];
}

/**
 * Create a new Google Doc with an optional template type.
 * Returns the created doc metadata.
 */
export async function createDoc(
  title: string,
  templateType: DocTemplateType = 'blank'
): Promise<GoogleDoc> {
  // 1. Create empty doc via Docs API
  const createRes = await fetch(DOCS_API, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) throw new Error(`Docs createDoc failed: ${createRes.status}`);
  const created = await createRes.json();
  const docId: string = created.documentId;

  // 2. Insert template content if not blank
  const content = TEMPLATE_CONTENT[templateType];
  if (content) {
    await fetch(`${DOCS_API}/${docId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
        ],
      }),
    });
  }

  return {
    id: docId,
    name: title,
    webViewLink: `https://docs.google.com/document/d/${docId}/edit`,
  };
}

/**
 * Get the Google Docs edit URL for a document.
 */
export function getDocUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

/**
 * Get basic metadata for a single document.
 */
export async function getDoc(docId: string): Promise<GoogleDoc> {
  const params = new URLSearchParams({
    fields: 'id,name,modifiedTime,webViewLink,owners,lastModifyingUser',
  });
  const res = await fetch(`${DRIVE_API}/files/${docId}?${params}`, {
    headers: { Authorization: getAuthHeader() },
  });
  if (!res.ok) throw new Error(`Docs getDoc failed: ${res.status}`);
  return res.json();
}

/** Get author display name from a doc object */
export function getDocAuthor(doc: GoogleDoc): string {
  return doc.lastModifyingUser?.displayName ?? doc.owners?.[0]?.displayName ?? '—';
}
