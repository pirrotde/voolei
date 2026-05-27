-- Migração para adicionar campo de timer de jogo
-- Executar no banco de dados remoto

-- Adicionar coluna game_timer na tabela room_state
ALTER TABLE room_state
ADD COLUMN IF NOT EXISTS game_timer JSON DEFAULT NULL
COMMENT 'Timer do jogo: {elapsedSeconds, isRunning, startedAt}'
AFTER enforce_gender_balance;
