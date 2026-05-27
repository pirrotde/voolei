-- Migração para adicionar novas funcionalidades
-- Executar no banco de dados remoto

-- 1. Adicionar coluna enforce_gender_balance na tabela room_state
ALTER TABLE room_state
ADD COLUMN IF NOT EXISTS enforce_gender_balance BOOLEAN DEFAULT TRUE
AFTER current_win_streak;

-- 2. Criar tabela matchup_history para histórico de confrontos
CREATE TABLE IF NOT EXISTS matchup_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(36) NOT NULL,
  team_a_ids JSON NOT NULL COMMENT 'IDs dos jogadores do time A (ordenados)',
  team_b_ids JSON NOT NULL COMMENT 'IDs dos jogadores do time B (ordenados)',
  team_a_score INT NOT NULL,
  team_b_score INT NOT NULL,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room (room_id),
  INDEX idx_played (played_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
