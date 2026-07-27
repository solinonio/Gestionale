# Project Guidelines & Architecture Rules

## 1. Archiviazione File ed Allegati (Regola Fondamentale)
- **MAI SALVARE FILE BINARI NEL DATABASE**: Non salvare mai stringhe Base64 (`data:`) o dati binari di file (PDF, immagini, documenti) nei campi del database MariaDB o nei file JSON locali.
- **I file PDF/documenti restano sul NAS locale**: Il server e il database gestiscono solo ed esclusivamente **collegamenti testuali/percorsi** (es. `path: "allegati/preventivo_123.pdf"` oppure `path: "X:\\NAS\\Preventivi\\file.pdf"`).
- **Metadati Allegati**: Gli oggetti `Attachment` salvati nel database contengono unicamente:
  - `id`: identificativo univoco
  - `filename`: nome del file (es: `"Offerta_2026.pdf"`)
  - `path`: percorso del file sul NAS / cartella allegati
  - `mimeType`: tipo MIME (es: `"application/pdf"`)
  - `size`: dimensione in byte
  - `uploadedAt`: data/ora di associazione
- **Anteprime in sessione**: Se l'utente seleziona un file dal browser, viene generato temporaneamente un URL Blob locale (`URL.createObjectURL`) per la sola durata della sessione di lavoro nel browser, senza mai memorizzare Base64 nel database.

## 2. Architettura Sincronizzazione Database
- Quando MariaDB è attivo e connesso, il server MariaDB è l'unica fonte di verità autoritativa.
- Nessuna unione arbitraria di elementi eliminati localmente durante la sincronizzazione.
