-- Script SQL per la tabella allegati (MariaDB)

-- Tabella per allegati clienti
CREATE TABLE IF NOT EXISTS allegati_clienti (
    id VARCHAR(50) PRIMARY KEY,
    cliente_id VARCHAR(50) NOT NULL,
    nome_file VARCHAR(255) NOT NULL,
    nome_originale TEXT NOT NULL,
    percorso_file TEXT NOT NULL,
    dimensione BIGINT DEFAULT 0,
    data_caricamento DATETIME DEFAULT CURRENT_TIMESTAMP,
    utente_inserimento VARCHAR(100),
    INDEX (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabella per allegati preventivi
CREATE TABLE IF NOT EXISTS allegati_preventivi (
    id VARCHAR(50) PRIMARY KEY,
    preventivo_id VARCHAR(50) NOT NULL,
    nome_file VARCHAR(255) NOT NULL,
    nome_originale TEXT NOT NULL,
    percorso_file TEXT NOT NULL,
    dimensione BIGINT DEFAULT 0,
    data_caricamento DATETIME DEFAULT CURRENT_TIMESTAMP,
    utente_inserimento VARCHAR(100),
    INDEX (preventivo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
