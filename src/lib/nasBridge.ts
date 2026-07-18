
/**
 * Utility per gestire l'accesso ai file locali (NAS) tramite File System Access API.
 * Questa API permette di "ingannare" le restrizioni del browser chiedendo all'utente
 * il permesso di accedere a una specifica cartella.
 */

import { get, set } from 'idb-keyval';

const DIR_HANDLE_KEY = 'nas_directory_handle';

/**
 * Richiede all'utente di selezionare la cartella principale del NAS.
 * Salva l'handle in IndexedDB per riutilizzarlo nelle sessioni successive.
 */
export async function connectNasFolder(): Promise<any | null> {
  try {
    if (!('showDirectoryPicker' in window)) {
      alert("Il tuo browser non supporta la File System Access API. Usa Chrome o Edge.");
      return null;
    }

    const handle = await (window as any).showDirectoryPicker({
      mode: 'read'
    });
    
    await set(DIR_HANDLE_KEY, handle);
    return handle;
  } catch (err) {
    console.error("Errore durante la connessione alla cartella NAS:", err);
    return null;
  }
}

/**
 * Controlla se abbiamo un handle salvato e se abbiamo ancora i permessi.
 */
export async function getNasFolderHandle() {
  try {
    const handle = await get(DIR_HANDLE_KEY);
    if (!handle) return null;

    // Verifica i permessi (possono scadere al riavvio del browser)
    const options = { mode: 'read' };
    if ((await handle.queryPermission(options)) === 'granted') {
      return handle;
    }

    // Se non sono garantiti, potremmo dover chiedere di nuovo, 
    // ma di solito queryPermission restituisce 'prompt'
    return handle;
  } catch (err) {
    console.error("Errore nel recupero dell'handle NAS:", err);
    return null;
  }
}

/**
 * Richiede esplicitamente il permesso se l'handle è salvato ma non attivo.
 */
export async function verifyNasPermission(handle: any): Promise<boolean> {
  if (!handle) return false;
  const options = { mode: 'read' };
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  return (await handle.requestPermission(options)) === 'granted';
}

/**
 * Cerca un file nel NAS dato il percorso relativo.
 * Il percorso deve essere relativo alla cartella selezionata (es. "PREVENTIVI/file.pdf").
 */
export async function getFileFromNas(relativePath: string): Promise<File | null> {
  const handle = await getNasFolderHandle();
  if (!handle) return null;

  if (!(await verifyNasPermission(handle))) {
    console.warn("Permesso negato per la cartella NAS.");
    return null;
  }

  try {
    // Pulisce il percorso da eventuali prefissi Windows o SMB se necessario
    // Assumiamo che l'utente selezioni la cartella "NAS" o "Preventivi" come radice.
    // Se il percorso è "\\NAS\Preventivi\file.pdf" e la radice è "\\NAS\Preventivi\",
    // cerchiamo solo "file.pdf".
    
    const nasRoot = localStorage.getItem('nas_root_path') || '';
    let cleanPath = relativePath;
    if (nasRoot && cleanPath.startsWith(nasRoot)) {
      cleanPath = cleanPath.substring(nasRoot.length);
    }
    
    // Normalizza separatori
    const parts = cleanPath.split(/[\\/]/).filter(p => p.length > 0);
    
    let currentHandle = handle;
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }
    
    const fileHandle = await currentHandle.getFileHandle(parts[parts.length - 1]);
    return await fileHandle.getFile();
  } catch (err) {
    console.error(`Impossibile trovare il file \${relativePath}:`, err);
    return null;
  }
}
