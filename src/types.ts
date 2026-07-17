/**
 * Tipi base per il sistema Gestionale Preventivi
 */

export interface CompanyInfo {
  name: string;
  address: string;
  cap: string;
  city: string;
  phone: string;
  email: string;
  vatNumber: string;
  sdiCode: string;
  pec: string;
  presentationText: string;
  conditionsText: string;
}

export interface ClientAttachment {
  id: string;
  path: string;
  filename: string;
  date: string;
  progressive: string;
  amount: number;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  intestazione?: string;
  email: string;
  phone?: string;
  address?: string;
  cap?: string;
  city?: string;
  vatNumber?: string;
  sdiCode?: string;
  attachmentPath?: string;
  attachmentDate?: string;
  attachmentProgressive?: string;
  attachmentAmount?: number;
  attachments?: ClientAttachment[];
}

export type CostCategory = 'MATERIAL' | 'LABOR';

// Il catalogo dei prodotti/servizi
export interface CostItem {
  id: string;
  name: string;
  category: CostCategory;
  unit: string; // kg, ora, pezzo, metro, ecc.
}

// Storico prezzi: permette di avere lo storico delle variazioni
export interface CostPrice {
  id: string;
  itemId: string;
  price: number;
  validFrom: Date;
  active: boolean; // Solo uno deve essere true per itemId
}

// Il Preventivo (Testata)
export interface Quotation {
  id?: string;
  clientId: string;
  number: string;
  year: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  date: string; // Changed to string for easier serialization
  totalAmount: number;
  companyInfo: CompanyInfo;
  clientInfo: Client;
  rows: QuotationRow[];
  notes: string;
  internalNotes: string;
  internalRows: InternalRow[];
  pdfUrl?: string;
  condizioni: string;
  presentationText: string;
  attachment?: string;
  attachmentsList?: string[];
  attachmentDate?: string;
  attachmentProgressive?: string;
  attachmentAmount?: number;
  showTotal?: boolean;
  trasporto?: 'incluso' | 'a carico del cliente' | null;
  installazione?: 'inclusa' | 'da quantificare' | null;
  collaudo?: 'incluso' | 'non incluso' | null;
  validita?: string;
  isImported?: boolean;
}

export interface InvoiceLine {
  num: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
  vatRate?: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  totalAmount: number;
  clientId: string | null; // ID of the matched registered client, or null if unmatched
  quotationId?: string | null; // ID of the matched quotation, or null if unmatched
  xmlFilename: string;
  isImported: boolean;
  xmlClientInfo: {
    name: string;
    vatNumber?: string;
    cf?: string;
    sdiCode?: string;
    address?: string;
    cap?: string;
    city?: string;
    email?: string;
  };
  xmlSupplierInfo?: {
    name: string;
    vatNumber?: string;
    cf?: string;
    address?: string;
    cap?: string;
    city?: string;
  };
  xmlLines?: InvoiceLine[];
}

// Voci del preventivo
export interface QuotationRow {
  id: string;
  description: string;
  quantity?: number | null;
  price?: number | null;
  isDescriptionOnly?: boolean;
  isOmaggio?: boolean;
  discount?: number | null; // Sconto in percentuale
}

// Voci note interne
export interface InternalRow {
  id: string;
  quantity: number;
  description: string;
  link?: string;
  details?: string;
  cost: number;
}

// Configurazione Lavorazione Laser
export interface LaserConfigRow {
  id: string;
  materiale: string;
  potenza: string;
  velocita: string;
  passaggi: string;
  frequenza: string;
  note: string;
  modalita?: string;
  dpi?: string;
  ppi?: string;
  tempoLavorazione?: string;
  clientId?: string; // Cliente abbinato
  aria?: boolean;
  aspirazione?: boolean;
  softwareLightburn?: boolean;
  softwareScaLaser?: boolean;
  softwareEzc?: boolean;
  origin?: 'X252' | 'Fibra' | 'Prometheo' | 'PHECDA';
  lastModifiedBy?: string; // Nome utente che ha effettuato l'ultima modifica
  colorRows?: LaserColorRow[];
  spessore?: number;
}

export interface LaserColorRow {
  id: string;
  raster: boolean;
  vector: boolean;
  colorRgb: string;
  velocita?: string;
  potenza?: string;
  frequenza?: string;
  passaggi?: string;
}

export interface LaserProcessingData {
  X352?: LaserConfigRow[];
  X252: LaserConfigRow[];
  Fibra: LaserConfigRow[];
  Prometheo: LaserConfigRow[];
  'PHECDA'?: LaserConfigRow[];
  savedMaterials?: Omit<LaserConfigRow, 'id' | 'clientId'>[];
  laserColorRows?: LaserColorRow[];
}

export type UserRole = 'ADMIN' | 'COLLABORATORE';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  createdAt?: string;
}

export interface SharedMaterial {
  id: string;
  name: string;
  thickness: number;
  cost?: number;
  length?: number;
  width?: number;
  link?: string;
  supplier?: string;
}


