import { Client, Quotation, CostItem, CompanyInfo, LaserProcessingData } from '../types';

export interface GitHubConfig {
  token: string;
  repo: string;
  filePath: string;
  branch: string;
  autoSync: boolean;
}

export interface SyncData {
  version: number;
  lastSynced: string;
  quotations: Quotation[];
  clients: Client[];
  catalog_items: CostItem[];
  company_profile: CompanyInfo | null;
  laser_processing_data?: LaserProcessingData;
}

const DEFAULT_CONFIG: GitHubConfig = {
  token: '',
  repo: 'solinonio/Gestionale',
  filePath: 'data/db.json',
  branch: 'main',
  autoSync: false
};

export const cleanRepoName = (repo: string): string => {
  let cleaned = repo.trim();
  // Remove any protocol or github.com prefix
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
  // Remove leading or trailing slashes
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');
  return cleaned;
};

export const getGitHubConfig = (): GitHubConfig => {
  try {
    const saved = localStorage.getItem('github_sync_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...DEFAULT_CONFIG, 
        ...parsed,
        repo: cleanRepoName(parsed.repo || DEFAULT_CONFIG.repo)
      };
    }
  } catch (e) {
    console.error('Error reading github config', e);
  }
  return DEFAULT_CONFIG;
};

export const saveGitHubConfig = (config: GitHubConfig): void => {
  const cleanedConfig = {
    ...config,
    repo: cleanRepoName(config.repo)
  };
  localStorage.setItem('github_sync_config', JSON.stringify(cleanedConfig));
};

// Gathers all local storage data into a single payload
export const exportLocalData = (): SyncData => {
  const getLocal = <T,>(key: string, def: T): T => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : def;
    } catch {
      return def;
    }
  };

  return {
    version: 1,
    lastSynced: new Date().toISOString(),
    quotations: getLocal<Quotation[]>('quotations', []),
    clients: getLocal<Client[]>('clients', []),
    catalog_items: getLocal<CostItem[]>('catalog_items', []),
    company_profile: getLocal<CompanyInfo | null>('company_profile', null),
    laser_processing_data: getLocal<LaserProcessingData | undefined>('laser_processing_data', undefined),
  };
};

// Imports the payload back into local storage
export const importLocalData = (data: Partial<SyncData>): void => {
  if (!data) return;
  if (Array.isArray(data.quotations)) {
    localStorage.setItem('quotations', JSON.stringify(data.quotations));
  }
  if (Array.isArray(data.clients)) {
    localStorage.setItem('clients', JSON.stringify(data.clients));
  }
  if (Array.isArray(data.catalog_items)) {
    localStorage.setItem('catalog_items', JSON.stringify(data.catalog_items));
  }
  if (data.company_profile) {
    localStorage.setItem('company_profile', JSON.stringify(data.company_profile));
  }
  if (data.laser_processing_data) {
    localStorage.setItem('laser_processing_data', JSON.stringify(data.laser_processing_data));
  }
};

// Merges remote data into local storage safely, avoiding duplicates by ID
export const mergeLocalAndRemote = (remote: Partial<SyncData>): { addedClients: number; addedQuotations: number } => {
  let addedClients = 0;
  let addedQuotations = 0;

  if (Array.isArray(remote.clients)) {
    const localClients = JSON.parse(localStorage.getItem('clients') || '[]') as Client[];
    const clientMap = new Map<string, Client>();
    localClients.forEach(c => {
      if (c.id) clientMap.set(c.id, c);
    });
    remote.clients.forEach(c => {
      if (c.id) {
        if (!clientMap.has(c.id)) {
          clientMap.set(c.id, c);
          addedClients++;
        } else {
          clientMap.set(c.id, c);
        }
      }
    });
    localStorage.setItem('clients', JSON.stringify(Array.from(clientMap.values())));
  }

  if (Array.isArray(remote.quotations)) {
    const localQuotations = JSON.parse(localStorage.getItem('quotations') || '[]') as Quotation[];
    const quotationMap = new Map<string, Quotation>();
    localQuotations.forEach(q => {
      if (q.id) quotationMap.set(q.id, q);
    });
    remote.quotations.forEach(q => {
      if (q.id) {
        if (!quotationMap.has(q.id)) {
          quotationMap.set(q.id, q);
          addedQuotations++;
        } else {
          quotationMap.set(q.id, q);
        }
      }
    });
    localStorage.setItem('quotations', JSON.stringify(Array.from(quotationMap.values())));
  }

  if (Array.isArray(remote.catalog_items)) {
    const localItems = JSON.parse(localStorage.getItem('catalog_items') || '[]') as CostItem[];
    const itemsMap = new Map<string, CostItem>();
    localItems.forEach(i => {
      if (i.id) itemsMap.set(i.id, i);
    });
    remote.catalog_items.forEach(i => {
      if (i.id) itemsMap.set(i.id, i);
    });
    localStorage.setItem('catalog_items', JSON.stringify(Array.from(itemsMap.values())));
  }

  if (remote.company_profile) {
    localStorage.setItem('company_profile', JSON.stringify(remote.company_profile));
  }

  if (remote.laser_processing_data) {
    localStorage.setItem('laser_processing_data', JSON.stringify(remote.laser_processing_data));
  }

  return { addedClients, addedQuotations };
};

// Push local database to GitHub
export const pushToGitHub = async (
  config: GitHubConfig,
  data: SyncData
): Promise<{ success: boolean; sha?: string; message: string }> => {
  const { token, repo, filePath, branch } = config;
  if (!token) {
    return { success: false, message: 'Token GitHub non configurato. Inseriscilo nelle impostazioni avanzate.' };
  }
  if (!repo) {
    return { success: false, message: 'Repository GitHub non configurato.' };
  }

  const cleanRepo = cleanRepoName(repo);
  const url = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}`;
  
  try {
    // 1. Get the current file's SHA if it exists
    let sha: string | undefined;
    const getRes = await fetch(`${url}?ref=${branch}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // 2. Prepare content
    const jsonStr = JSON.stringify(data, null, 2);
    // Use btoa safely supporting UTF-8
    const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

    // 3. Put/Update file
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Aggiornamento database gestionale preventivi [Auto-Sync]',
        content: base64Content,
        sha,
        branch
      })
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      const apiMsg = err.message || putRes.statusText;
      let errorMsg = `Errore GitHub API: ${apiMsg}`;
      if (putRes.status === 404) {
        errorMsg = `Errore 404 (Non Trovato): Verifica che il nome del repository "${cleanRepo}" sia corretto ed esista su GitHub. Se il repository è privato, assicurati che il tuo Token abbia i permessi "repo".`;
      }
      return { success: false, message: errorMsg };
    }

    const putData = await putRes.json();
    return { success: true, sha: putData.content?.sha, message: 'Sincronizzazione completata con successo!' };
  } catch (error: any) {
    console.error('GitHub Push error:', error);
    return { success: false, message: `Errore di connessione: ${error.message}` };
  }
};

// Pull database from GitHub
export const pullFromGitHub = async (
  config: GitHubConfig
): Promise<{ success: boolean; data?: SyncData; sha?: string; message: string }> => {
  const { token, repo, filePath, branch } = config;
  if (!repo) {
    return { success: false, message: 'Repository GitHub non configurato nelle impostazioni.' };
  }

  const cleanRepo = cleanRepoName(repo);
  const url = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}?ref=${branch}`;

  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token && token.trim() !== '') {
      headers['Authorization'] = `token ${token}`;
    }

    const res = await fetch(url, { headers });

    if (res.status === 404) {
      return { 
        success: false, 
        message: `File o Repository non trovato (Errore 404). Verifica che:\n\n1. Il nome del repository "${cleanRepo}" sia corretto.\n2. Il percorso del file "${filePath}" nel branch "${branch}" esista su GitHub.\n3. Se il repository è privato, devi inserire un Token di accesso GitHub valido nelle impostazioni avanzate (senza di esso, GitHub restituisce sempre "404 Not Found" per motivi di sicurezza).` 
      };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: `Errore GitHub API: ${err.message || res.statusText}` };
    }

    const fileData = await res.json();
    const utf8Content = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
    const data = JSON.parse(utf8Content) as SyncData;

    return { success: true, data, sha: fileData.sha, message: 'Dati scaricati con successo!' };
  } catch (error: any) {
    console.error('GitHub Pull error:', error);
    return { success: false, message: `Errore di connessione o formato del file: ${error.message}` };
  }
};

export const CURRENT_VERSION = "3.5.3";

export const isVersionOlder = (local: string, remote: string): boolean => {
  const localParts = local.replace(/^v/i, '').split('.').map(Number);
  const remoteParts = remote.replace(/^v/i, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
    const localVal = localParts[i] || 0;
    const remoteVal = remoteParts[i] || 0;
    if (localVal < remoteVal) return true;
    if (localVal > remoteVal) return false;
  }
  return false;
};

export const checkSoftwareUpdate = async (
  config: GitHubConfig
): Promise<{ success: boolean; hasUpdate: boolean; currentVersion: string; remoteVersion: string; message: string }> => {
  const { token, repo, branch } = config;
  if (!repo) {
    return { success: false, hasUpdate: false, currentVersion: CURRENT_VERSION, remoteVersion: '', message: 'Repository GitHub non configurato.' };
  }

  const cleanRepo = cleanRepoName(repo);
  const url = `https://api.github.com/repos/${cleanRepo}/contents/package.json?ref=${branch}`;

  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token && token.trim() !== '') {
      headers['Authorization'] = `token ${token}`;
    }

    const res = await fetch(url, { headers });

    if (res.status === 404) {
      return { 
        success: false, 
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        remoteVersion: '',
        message: `File package.json o Repository non trovato (Errore 404).`
      };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { 
        success: false, 
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        remoteVersion: '',
        message: `Errore GitHub API: ${err.message || res.statusText}` 
      };
    }

    const fileData = await res.json();
    const utf8Content = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
    const pkg = JSON.parse(utf8Content);
    const remoteVersion = pkg.version || '0.0.0';

    const hasUpdate = isVersionOlder(CURRENT_VERSION, remoteVersion);

    return {
      success: true,
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      remoteVersion,
      message: hasUpdate ? `Nuova versione v${remoteVersion} disponibile!` : 'Il software è già aggiornato.'
    };
  } catch (error: any) {
    console.error('GitHub version check error:', error);
    return { 
      success: false, 
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      remoteVersion: '',
      message: `Errore di connessione o formato: ${error.message}` 
    };
  }
};

