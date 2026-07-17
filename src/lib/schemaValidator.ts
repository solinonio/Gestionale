import { Quotation, QuotationRow, InternalRow } from '../types';

/**
 * Valida un singolo oggetto Quotation rispetto allo schema atteso in types.ts.
 * Restituisce un array di messaggi di errore (vuoto se l'oggetto è perfettamente conforme).
 */
export function validateQuotationSchema(q: any): string[] {
  const errors: string[] = [];

  if (!q || typeof q !== 'object') {
    return ['Il preventivo non è un oggetto valido o è nullo.'];
  }

  // Id (opzionale ma se c'è deve essere stringa)
  if (q.id !== undefined && typeof q.id !== 'string') {
    errors.push(`'id' deve essere una stringa, ricevuto: ${typeof q.id}`);
  }

  // ClientId (obbligatorio)
  if (!q.clientId || typeof q.clientId !== 'string') {
    errors.push(`'clientId' è obbligatorio e deve essere una stringa, ricevuto: ${typeof q.clientId}`);
  }

  // Number (obbligatorio)
  if (q.number === undefined || q.number === null || typeof q.number !== 'string') {
    errors.push(`'number' è obbligatorio e deve essere una stringa, ricevuto: ${typeof q.number}`);
  }

  // Year (obbligatorio)
  if (typeof q.year !== 'number' || isNaN(q.year)) {
    errors.push(`'year' è obbligatorio e deve essere un numero valido, ricevuto: ${typeof q.year}`);
  }

  // Status (obbligatorio)
  const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];
  if (!validStatuses.includes(q.status)) {
    errors.push(`'status' deve essere uno tra DRAFT, SENT, ACCEPTED, REJECTED, ricevuto: '${q.status}'`);
  }

  // Date (obbligatorio)
  if (!q.date || typeof q.date !== 'string') {
    errors.push(`'date' è obbligatorio e deve essere una stringa, ricevuto: ${typeof q.date}`);
  }

  // TotalAmount (obbligatorio)
  if (typeof q.totalAmount !== 'number' || isNaN(q.totalAmount)) {
    errors.push(`'totalAmount' è obbligatorio e deve essere un numero valido, ricevuto: ${typeof q.totalAmount}`);
  }

  // CompanyInfo (obbligatorio)
  if (!q.companyInfo || typeof q.companyInfo !== 'object') {
    errors.push(`'companyInfo' è obbligatorio e deve essere un oggetto`);
  } else {
    if (!q.companyInfo.name || typeof q.companyInfo.name !== 'string') {
      errors.push(`'companyInfo.name' è obbligatorio e deve essere una stringa`);
    }
  }

  // ClientInfo (obbligatorio)
  if (!q.clientInfo || typeof q.clientInfo !== 'object') {
    errors.push(`'clientInfo' è obbligatorio e deve essere un oggetto`);
  } else {
    if (!q.clientInfo.name || typeof q.clientInfo.name !== 'string') {
      errors.push(`'clientInfo.name' è obbligatorio e deve essere una stringa`);
    }
  }

  // Rows (obbligatorio)
  if (!Array.isArray(q.rows)) {
    errors.push(`'rows' è obbligatorio e deve essere un array`);
  } else {
    q.rows.forEach((row: any, i: number) => {
      if (!row || typeof row !== 'object') {
        errors.push(`'rows[${i}]' non è un oggetto valido`);
      } else {
        if (!row.id || typeof row.id !== 'string') {
          errors.push(`'rows[${i}].id' deve essere una stringa`);
        }
        if (row.description === undefined || typeof row.description !== 'string') {
          errors.push(`'rows[${i}].description' deve essere una stringa`);
        }
      }
    });
  }

  // InternalRows (obbligatorio)
  if (!Array.isArray(q.internalRows)) {
    errors.push(`'internalRows' è obbligatorio e deve essere un array`);
  } else {
    q.internalRows.forEach((row: any, i: number) => {
      if (!row || typeof row !== 'object') {
        errors.push(`'internalRows[${i}]' non è un oggetto valido`);
      } else {
        if (!row.id || typeof row.id !== 'string') {
          errors.push(`'internalRows[${i}].id' deve essere una stringa`);
        }
        if (row.description === undefined || typeof row.description !== 'string') {
          errors.push(`'internalRows[${i}].description' deve essere una stringa`);
        }
      }
    });
  }

  // Altri campi opzionali
  if (q.notes !== undefined && typeof q.notes !== 'string') {
    errors.push(`'notes' deve essere una stringa`);
  }
  if (q.internalNotes !== undefined && typeof q.internalNotes !== 'string') {
    errors.push(`'internalNotes' deve essere una stringa`);
  }
  if (q.condizioni !== undefined && typeof q.condizioni !== 'string') {
    errors.push(`'condizioni' deve essere una stringa`);
  }
  if (q.presentationText !== undefined && typeof q.presentationText !== 'string') {
    errors.push(`'presentationText' deve essere una stringa`);
  }

  return errors;
}

/**
 * Verifica l'intera consistenza dello schema dei preventivi per dati_gestionale.json
 */
export function verifyDatiGestionaleSchemaConsistency(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push("Il database locale non è un oggetto valido.");
    return { isValid: false, errors };
  }

  // Verifica dei campi principali
  const expectedKeys = ['quotations', 'clients', 'catalog_items', 'company_profile', 'laser_processing_data', 'users', 'invoices'];
  
  for (const key of expectedKeys) {
    if (data[key] !== undefined && data[key] !== null) {
      if (key !== 'company_profile' && key !== 'laser_processing_data' && !Array.isArray(data[key])) {
        errors.push(`La chiave '${key}' nel database deve essere un array, ricevuto: ${typeof data[key]}`);
      }
    }
  }

  // Validazione approfondita dei preventivi (quotations)
  if (Array.isArray(data.quotations)) {
    data.quotations.forEach((q: any, index: number) => {
      const qErrors = validateQuotationSchema(q);
      if (qErrors.length > 0) {
        errors.push(`Preventivo #${index + 1} (N°: ${q.number || 'N/D'}, Anno: ${q.year || 'N/D'}): ` + qErrors.join('; '));
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
