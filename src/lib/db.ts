import { CostItem, Quotation, CompanyInfo, Client, LaserProcessingData, LaserConfigRow, User, UserRole, Invoice, Materiale } from '../types';
import { validateQuotationSchema, verifyDatiGestionaleSchemaConsistency } from './schemaValidator';

// Helper to generate unique IDs
const generateId = (): string => {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`localStorage.getItem failed for key "${key}":`, e);
    return null;
  }
};

export const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`localStorage.setItem failed for key "${key}":`, e);
  }
};

// Helper for local storage access with type safety
const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const value = safeGetItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
    return defaultValue;
  }
};

const setLocalStorageItem = async <T,>(key: string, value: T): Promise<void> => {
  try {
    safeSetItem(key, JSON.stringify(value));
    // Mirror to server's local file database
    const response = await fetch('/api/local-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
    if (!response.ok) {
        throw new Error(`Failed to save ${key} to server: ${response.statusText}`);
    }
  } catch (e) {
    console.error(`Error writing ${key} to localStorage or server`, e);
    throw e; // Rethrow to let caller handle it
  }
};

let lastSyncTime = 0;
const SYNC_COOLDOWN = 1500; // 1.5 seconds cooldown

let currentDbStatus: { dbType: 'mariadb' | 'mariadb-fallback' | 'json'; fallbackReason?: string } = { dbType: 'json' };

export const getDbStatus = () => currentDbStatus;

export const syncWithServer = async (force: boolean = false): Promise<void> => {
  const now = Date.now();
  if (!force && now - lastSyncTime < SYNC_COOLDOWN) {
    return;
  }
  try {
    const res = await fetch('/api/local-db');
    if (!res.ok) {
      if (currentDbStatus.dbType !== 'json') {
        currentDbStatus = { dbType: 'json', fallbackReason: 'Impossibile connettersi al server locale' };
        window.dispatchEvent(new CustomEvent('database-status-updated'));
      }
      return;
    }
    const json = await res.json();
    
    // Aggiorna lo stato del database
    const newDbType = json.dbType || 'json';
    if (currentDbStatus.dbType !== newDbType || currentDbStatus.fallbackReason !== json.fallbackReason) {
      currentDbStatus = { dbType: newDbType, fallbackReason: json.fallbackReason };
      window.dispatchEvent(new CustomEvent('database-status-updated'));
    }

    if (json.success && json.data) {
      const fileData = json.data;
      const keys = ['quotations', 'clients', 'catalog_items', 'company_profile', 'laser_processing_data', 'users', 'invoices', 'materiali'] as const;
      const payloadToSave: Record<string, any> = {};
      let needsSaveToServer = false;
      let hasChanges = false;

      for (const key of keys) {
        const fileVal = fileData[key];
        const localValStr = safeGetItem(key);
        
        if (fileVal !== undefined) {
          const fileValStr = JSON.stringify(fileVal);
          if (localValStr !== fileValStr) {
            if (key === 'quotations' && !force) {
                console.log(`[sync] Skipping overwrite of ${key} from server to protect local data.`);
            } else {
                console.log(`[sync] Overwriting ${key} from server.`);
                safeSetItem(key, fileValStr);
                hasChanges = true;
            }
          }
        } else if (localValStr !== null) {
          try {
            payloadToSave[key] = JSON.parse(localValStr);
            needsSaveToServer = true;
          } catch (e) {}
        }
      }

      if (hasChanges) {
        window.dispatchEvent(new CustomEvent('database-synced'));
      }

      if (needsSaveToServer) {
        await fetch('/api/local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadToSave)
        });
      }
      lastSyncTime = now;
    }
  } catch (err: any) {
    console.warn('Sincronizzazione con il server non riuscita, uso cache locale:', err);
    if (currentDbStatus.dbType !== 'json') {
      currentDbStatus = { dbType: 'json', fallbackReason: err.message };
      window.dispatchEvent(new CustomEvent('database-status-updated'));
    }
  }
};

export const initializeLocalDatabase = async (): Promise<boolean> => {
  try {
    await syncWithServer(true);
    await initializeDefaultUsers();
    return true;
  } catch (err) {
    console.error('Errore nell\'inizializzazione del database locale:', err);
    return false;
  }
};

// Catalog Helpers
export const getCatalogItems = async (): Promise<CostItem[]> => {
  await syncWithServer();
  const items = getLocalStorageItem<CostItem[]>('catalog_items', []);
  return items.sort((a, b) => a.name.localeCompare(b.name));
};

export const addCatalogItem = async (item: Omit<CostItem, 'id'>) => {
  await syncWithServer(); // Get latest
  const items = getLocalStorageItem<CostItem[]>('catalog_items', []);
  const newItem = { ...item, id: generateId() };
  items.push(newItem);
  await setLocalStorageItem('catalog_items', items);
  await syncWithServer(true); // Push immediately
  return { id: newItem.id };
};

// Quotation Helpers
export const getQuotations = async (): Promise<Quotation[]> => {
  await syncWithServer();
  const quotations = getLocalStorageItem<Quotation[]>('quotations', []);
  // Sort by date desc, then by number desc
  return quotations.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return parseInt(b.number || '0') - parseInt(a.number || '0');
  });
};

export const getQuotationsByClient = async (clientId: string): Promise<Quotation[]> => {
  await syncWithServer();
  const quotations = getLocalStorageItem<Quotation[]>('quotations', []);
  return quotations
    .filter(q => q.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const saveQuotation = async (quotation: Omit<Quotation, 'id'>) => {
  console.log("saveQuotation called:", quotation);
  
  // Validate the incoming quotation object before saving
  const validationErrors = validateQuotationSchema(quotation);
  if (validationErrors.length > 0) {
    console.error("Schema Consistency Warning for new quotation:", validationErrors);
  }

  // Sync before to ensure we have latest list
  await syncWithServer(); 
  const quotations = getLocalStorageItem<Quotation[]>('quotations', []);
  const newQuotation = { ...quotation, id: generateId() };
  quotations.push(newQuotation);
  
  // Save locally and push to server
  await setLocalStorageItem('quotations', quotations);
  await syncWithServer(true); // Force push
  
  window.dispatchEvent(new CustomEvent('database-synced'));
  console.log("saveQuotation successful:", newQuotation.id);
  return { id: newQuotation.id };
};

export const updateQuotation = async (quotationId: string, quotation: Omit<Quotation, 'id'>) => {
  console.log("updateQuotation called:", quotationId, quotation);

  // Validate the incoming quotation object before saving
  const validationErrors = validateQuotationSchema(quotation);
  if (validationErrors.length > 0) {
    console.error(`Schema Consistency Warning for quotation update (${quotationId}):`, validationErrors);
  }

  await syncWithServer(); // Get latest
  const quotations = getLocalStorageItem<Quotation[]>('quotations', []);
  const index = quotations.findIndex(q => q.id === quotationId);
  if (index !== -1) {
    quotations[index] = { ...quotation, id: quotationId };
    await setLocalStorageItem('quotations', quotations);
  } else {
    console.warn(`Quotation with ID ${quotationId} not found for update. Creating new one.`);
    const newQuotation = { ...quotation, id: quotationId };
    quotations.push(newQuotation);
    await setLocalStorageItem('quotations', quotations);
  }
  await syncWithServer(true); // Push changes
  window.dispatchEvent(new CustomEvent('database-synced'));
};

export const deleteQuotation = async (quotationId: string) => {
  await syncWithServer(); // Get latest
  const quotations = getLocalStorageItem<Quotation[]>('quotations', []);
  const filtered = quotations.filter(q => q.id !== quotationId);
  await setLocalStorageItem('quotations', filtered);
  await syncWithServer(true); // Push deletion
  window.dispatchEvent(new CustomEvent('database-synced'));
};

export const deleteAllQuotations = async () => {
  await setLocalStorageItem('quotations', []);
};

// Company Profile Helpers
export const getCompanyProfile = async (): Promise<CompanyInfo | null> => {
  await syncWithServer();
  return getLocalStorageItem<CompanyInfo | null>('company_profile', null);
};

export const updateCompanyProfile = async (data: CompanyInfo) => {
  await setLocalStorageItem('company_profile', data);
};

// Client Helpers
export const getClients = async (): Promise<Client[]> => {
  await syncWithServer();
  const clients = getLocalStorageItem<Client[]>('clients', []);
  return clients.sort((a, b) => {
    const nameA = a.intestazione || a.name || '';
    const nameB = b.intestazione || b.name || '';
    return nameA.localeCompare(nameB);
  });
};

export const addClient = async (client: Omit<Client, 'id'>) => {
  if (!client.name) throw new Error('Client name is required');
  await syncWithServer(); // Get latest
  const clients = getLocalStorageItem<Client[]>('clients', []);
  const newClient = { ...client, id: generateId() };
  clients.push(newClient);
  await setLocalStorageItem('clients', clients);
  await syncWithServer(true); // Push immediately
  return { id: newClient.id };
};

export const updateClient = async (clientId: string, client: Omit<Client, 'id'>) => {
  if (!client.name) throw new Error('Client name is required');
  await syncWithServer(); // Get latest
  const clients = getLocalStorageItem<Client[]>('clients', []);
  const index = clients.findIndex(c => c.id === clientId);
  if (index !== -1) {
    clients[index] = { ...client, id: clientId };
    await setLocalStorageItem('clients', clients);
  } else {
    console.warn(`Client with ID ${clientId} not found for update. Creating new one.`);
    const newClient = { ...client, id: clientId };
    clients.push(newClient);
    await setLocalStorageItem('clients', clients);
  }
  await syncWithServer(true); // Push changes
};

// Default Laser Processing data (initial state)
const DEFAULT_LASER_DATA: LaserProcessingData = {
  X252: [
    { id: 'x1', materiale: 'Legno Pioppo 4mm', potenza: '80%', velocita: '15', passaggi: '1', frequenza: '20000 Hz', note: 'Taglio pulito, assistenza aria alta' },
    { id: 'x2', materiale: 'Plexiglass Cast 3mm', potenza: '90%', velocita: '10', passaggi: '1', frequenza: '20000 Hz', note: 'Finitura lucida sul bordo, no fiamme' },
    { id: 'x3', materiale: 'Pelle Naturale 2mm', potenza: '30%', velocita: '40', passaggi: '1', frequenza: '15000 Hz', note: 'Incisione scura superficiale, odore forte' }
  ],
  Fibra: [
    { id: 'f1', materiale: 'Acciaio Inox 1mm', potenza: '50%', velocita: '800', passaggi: '3', frequenza: '30000 Hz', note: 'Incisione profonda, scura e definita' },
    { id: 'f2', materiale: 'Alluminio Anodizzato', potenza: '45%', velocita: '1200', passaggi: '1', frequenza: '40000 Hz', note: 'Marcatura bianca brillante' },
    { id: 'f3', materiale: 'Ottone Satinato 1.5mm', potenza: '70%', velocita: '500', passaggi: '5', frequenza: '25000 Hz', note: 'Incisione ad alto contrasto' }
  ],
  Prometheo: [
    { id: 'p1', materiale: 'MDF Standard 3mm', potenza: '85%', velocita: '25', passaggi: '1', frequenza: '18000 Hz', note: 'Bordo scuro uniforme, taglio rapido' },
    { id: 'p2', materiale: 'Cartone pressato 2mm', potenza: '25%', velocita: '80', passaggi: '1', frequenza: '10000 Hz', note: 'Taglio sagomato ultra-veloce' },
    { id: 'p3', materiale: 'Vetro (verniciato nero)', potenza: '45%', velocita: '300', passaggi: '1', frequenza: '22000 Hz', note: 'Sabbiatura laser, rimuovere vernice dopo' }
  ],
  'PHECDA': [
    { id: 'e1', materiale: 'Legno Compensato 3mm', potenza: '80%', velocita: '20', passaggi: '1', frequenza: '15000 Hz', note: 'Taglio preciso, bruciatura minima' }
  ],
  laserColorRows: [
    { id: 'lc1', raster: true, vector: false, colorRgb: '#FF0000' },
    { id: 'lc2', raster: false, vector: true, colorRgb: '#0000FF' }
  ]
};

export const getLaserProcessingData = async (): Promise<LaserProcessingData> => {
  await syncWithServer();
  const data = getLocalStorageItem<any>('laser_processing_data', DEFAULT_LASER_DATA);
  if (data && data.X352 && !data.X252) {
    data.X252 = data.X352;
    delete data.X352;
  }
  if (data && !data.X252) {
    data.X252 = DEFAULT_LASER_DATA.X252;
  }
  if (data && data['ELEGOO PHECDA'] && !data['PHECDA']) {
    data['PHECDA'] = data['ELEGOO PHECDA'];
    delete data['ELEGOO PHECDA'];
  }
  return data;
};

export const saveLaserProcessingData = async (data: LaserProcessingData): Promise<void> => {
  await setLocalStorageItem('laser_processing_data', data);
};

export const deleteClient = async (clientId: string): Promise<void> => {
  await syncWithServer(); // Get latest
  const clients = getLocalStorageItem<Client[]>('clients', []);
  const filtered = clients.filter(c => c.id !== clientId);
  await setLocalStorageItem('clients', filtered);
  await syncWithServer(true); // Push deletion
};

// User Management Helpers
export const getUsers = async (): Promise<User[]> => {
  await syncWithServer();
  return getLocalStorageItem<User[]>('users', []);
};

export const addUser = async (user: Omit<User, 'id'>) => {
  await syncWithServer(); // Get latest
  const users = getLocalStorageItem<User[]>('users', []);
  const newUser = { ...user, id: generateId(), createdAt: new Date().toISOString() };
  users.push(newUser);
  await setLocalStorageItem('users', users);
  await syncWithServer(true); // Push immediately
  return { id: newUser.id };
};

export const updateUser = async (userId: string, user: Omit<User, 'id' | 'createdAt'>) => {
  await syncWithServer(); // Get latest
  const users = getLocalStorageItem<User[]>('users', []);
  const index = users.findIndex(u => u.id === userId);
  if (index !== -1) {
    users[index] = { ...users[index], ...user };
    await setLocalStorageItem('users', users);
    await syncWithServer(true); // Push changes
  }
};

export const deleteUser = async (userId: string) => {
  await syncWithServer(); // Get latest
  const users = getLocalStorageItem<User[]>('users', []);
  const filtered = users.filter(u => u.id !== userId);
  await setLocalStorageItem('users', filtered);
  await syncWithServer(true); // Push deletion
};

export const initializeDefaultUsers = async (): Promise<void> => {
  const users = getLocalStorageItem<User[]>('users', []);
  const adminExists = users.some(u => u.username === 'OldGame');
  if (!adminExists) {
    users.push({
      id: generateId(),
      username: 'OldGame',
      password: 'Futti$78@@@',
      role: 'ADMIN',
      createdAt: new Date().toISOString()
    });
    await setLocalStorageItem('users', users);
  }
};

export const uploadAttachment = async (file: File, type: 'client' | 'quotation', id: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/upload/${type}/${id}`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to upload attachment: ${response.statusText}`);
    }
    return response.json();
};

export const getAttachments = async (type: 'client' | 'quotation', id: string) => {
    const response = await fetch(`/api/attachments/${type}/${id}`);
    if (!response.ok) {
        throw new Error(`Failed to get attachments: ${response.statusText}`);
    }
    const data = await response.json();
    return data.attachments;
};

export const downloadAttachment = async (id: string) => {
    window.open(`/api/attachments/download/${id}`, '_blank');
};

export const deleteAttachment = async (id: string) => {
    const response = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Failed to delete attachment: ${response.statusText}`);
    }
    return response.json();
};

// Invoice Helpers
export const getInvoices = async (): Promise<Invoice[]> => {
  await syncWithServer();
  const invoices = getLocalStorageItem<Invoice[]>('invoices', []);
  // Sort by date desc, then by number desc
  return invoices.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return b.number.localeCompare(a.number);
  });
};

export const saveInvoice = async (invoice: Omit<Invoice, 'id'>) => {
  await syncWithServer(); // Get latest
  const invoices = getLocalStorageItem<Invoice[]>('invoices', []);
  const newInvoice = { ...invoice, id: generateId() };
  invoices.push(newInvoice);
  await setLocalStorageItem('invoices', invoices);
  await syncWithServer(true); // Push immediately
  window.dispatchEvent(new CustomEvent('database-synced'));
  return { id: newInvoice.id };
};

export const saveInvoicesBulk = async (newInvoices: Omit<Invoice, 'id'>[]) => {
  await syncWithServer(); // Get latest
  const invoices = getLocalStorageItem<Invoice[]>('invoices', []);
  const added: Invoice[] = [];
  for (const inv of newInvoices) {
    if (invoices.some(existing => existing.xmlFilename === inv.xmlFilename)) {
      continue;
    }
    const newInv = { ...inv, id: generateId() };
    invoices.push(newInv);
    added.push(newInv);
  }
  if (added.length > 0) {
    await setLocalStorageItem('invoices', invoices);
    await syncWithServer(true); // Push bulk
    window.dispatchEvent(new CustomEvent('database-synced'));
  }
  return added;
};

export const updateInvoice = async (invoiceId: string, invoice: Omit<Invoice, 'id'>) => {
  await syncWithServer(); // Get latest
  const invoices = getLocalStorageItem<Invoice[]>('invoices', []);
  const index = invoices.findIndex(i => i.id === invoiceId);
  if (index !== -1) {
    invoices[index] = { ...invoice, id: invoiceId };
    await setLocalStorageItem('invoices', invoices);
  } else {
    const newInvoice = { ...invoice, id: invoiceId };
    invoices.push(newInvoice);
    await setLocalStorageItem('invoices', invoices);
  }
  await syncWithServer(true); // Push changes
  window.dispatchEvent(new CustomEvent('database-synced'));
};

export const deleteInvoice = async (invoiceId: string) => {
  await syncWithServer(); // Get latest
  const invoices = getLocalStorageItem<Invoice[]>('invoices', []);
  const filtered = invoices.filter(i => i.id !== invoiceId);
  await setLocalStorageItem('invoices', filtered);
  await syncWithServer(true); // Push deletion
  window.dispatchEvent(new CustomEvent('database-synced'));
};

const DEFAULT_MATERIALI: Materiale[] = [
  { id: 'sm1', nome: 'Legno Pioppo', spessore: 4, prezzoLastra: 25, lunghezza: 100, larghezza: 100 },
  { id: 'sm2', nome: 'Plexiglass Cast', spessore: 3, prezzoLastra: 35, lunghezza: 100, larghezza: 100 },
  { id: 'sm3', nome: 'Pelle Naturale', spessore: 2, prezzoLastra: 45, lunghezza: 50, larghezza: 50 },
  { id: 'sm4', nome: 'MDF Standard', spessore: 3, prezzoLastra: 15, lunghezza: 100, larghezza: 100 },
  { id: 'sm5', nome: 'Cartone pressato', spessore: 2, prezzoLastra: 5, lunghezza: 100, larghezza: 100 },
  { id: 'sm6', nome: 'Vetro', spessore: 4, prezzoLastra: 12, lunghezza: 60, larghezza: 60 },
  { id: 'sm7', nome: 'Legno Compensato', spessore: 3, prezzoLastra: 18, lunghezza: 100, larghezza: 100 }
];

export const getMateriali = async (): Promise<Materiale[]> => {
  await syncWithServer(true); // Force sync to ensure we get latest data from MariaDB
  return getLocalStorageItem<Materiale[]>('materiali', DEFAULT_MATERIALI);
};

export const addMateriale = async (material: Omit<Materiale, 'id'>): Promise<Materiale> => {
  await syncWithServer(); // Get latest from server before adding
  const list = getLocalStorageItem<Materiale[]>('materiali', DEFAULT_MATERIALI);
  const newMat = { ...material, id: generateId() };
  list.push(newMat);
  await setLocalStorageItem('materiali', list);
  await syncWithServer(true); // Force immediate push to server
  window.dispatchEvent(new CustomEvent('database-synced'));
  return newMat;
};

export const updateMateriale = async (id: string, material: Omit<Materiale, 'id'>): Promise<void> => {
  await syncWithServer(); // Get latest
  const list = getLocalStorageItem<Materiale[]>('materiali', DEFAULT_MATERIALI);
  const idx = list.findIndex(m => m.id === id);
  if (idx !== -1) {
    list[idx] = { ...material, id };
    await setLocalStorageItem('materiali', list);
    await syncWithServer(true); // Push changes
    window.dispatchEvent(new CustomEvent('database-synced'));
  }
};

export const deleteMateriale = async (id: string): Promise<void> => {
  await syncWithServer(); // Get latest from server to ensure we are deleting from current state
  const list = getLocalStorageItem<Materiale[]>('materiali', DEFAULT_MATERIALI);
  const filtered = list.filter(m => m.id !== id);
  await setLocalStorageItem('materiali', filtered);
  await syncWithServer(true); // Push the deletion to server immediately
  window.dispatchEvent(new CustomEvent('database-synced'));
};


