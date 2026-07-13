-- Full schema for the pinball prediction system.
-- Not required to run the current demo (which reads/writes predictions.json
-- directly) -- this is here for when you wire up real MatchPlay/IFPA
-- ingestion and want persistent history across tournaments.

CREATE TABLE players (
    player_id           SERIAL PRIMARY KEY,
    display_name        VARCHAR(255) NOT NULL,
    ifpa_id             INTEGER UNIQUE,
    matchplay_user_id    INTEGER UNIQUE,
    home_region          VARCHAR(100),
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE player_ratings_history (
    id              BIGSERIAL PRIMARY KEY,
    player_id       INTEGER REFERENCES players(player_id),
    rating_type     VARCHAR(20) NOT NULL,   -- 'elo' | 'ifpa_wppr' | 'matchplay_rating'
    rating_value    NUMERIC(10,2) NOT NULL,
    as_of           TIMESTAMPTZ NOT NULL,
    source          VARCHAR(20) NOT NULL,   -- 'ifpa' | 'matchplay' | 'computed'
    UNIQUE(player_id, rating_type, as_of)
);

CREATE TABLE tournaments (
    tournament_id            SERIAL PRIMARY KEY,
    matchplay_tournament_id   INTEGER UNIQUE,
    name                      VARCHAR(255) NOT NULL,
    event_tier                VARCHAR(20),   -- 'state' | 'national' | 'world'
    format                    VARCHAR(30),   -- 'group_match_play' | 'head_to_head_bracket' | 'max_match_play'
    start_date                DATE,
    location                  VARCHAR(255),
    bracket_size              INTEGER,
    games_per_round            INTEGER,
    scoring_system             VARCHAR(20),
    status                     VARCHAR(20),  -- 'planned' | 'active' | 'completed'
    raw_payload                JSONB
);

CREATE TABLE tournament_players (
    id               BIGSERIAL PRIMARY KEY,
    tournament_id    INTEGER REFERENCES tournaments(tournament_id),
    player_id        INTEGER REFERENCES players(player_id),
    seed             INTEGER,
    starting_rating  NUMERIC(10,2),
    final_position   INTEGER,
    UNIQUE(tournament_id, player_id)
);

CREATE TABLE matches (
    match_id             BIGSERIAL PRIMARY KEY,
    tournament_id        INTEGER REFERENCES tournaments(tournament_id),
    round_number         INTEGER,
    round_label          VARCHAR(50),  -- 'R1','QF','SF','F', or a group-round number
    match_format         VARCHAR(20),  -- 'best_of_7' | 'single_game' | 'group_of_4'
    matchplay_game_id     INTEGER,
    status               VARCHAR(20),  -- 'scheduled' | 'in_progress' | 'completed'
    completed_at          TIMESTAMPTZ,
    raw_payload           JSONB
);

CREATE TABLE match_results (
    id             BIGSERIAL PRIMARY KEY,
    match_id       BIGINT REFERENCES matches(match_id),
    player_id      INTEGER REFERENCES players(player_id),
    placement      INTEGER,
    points_earned   NUMERIC(6,2),
    score          BIGINT,
    is_winner      BOOLEAN
);

CREATE TABLE features (
    id                     BIGSERIAL PRIMARY KEY,
    tournament_id          INTEGER REFERENCES tournaments(tournament_id),
    player_id              INTEGER REFERENCES players(player_id),
    computed_at             TIMESTAMPTZ DEFAULT now(),
    ifpa_wppr_rank           INTEGER,
    ifpa_wppr_value          NUMERIC(10,3),
    elo_rating               NUMERIC(10,2),
    recent_win_rate          NUMERIC(5,4),
    recent_avg_finish         NUMERIC(6,2),
    h2h_win_rate_vs_field     NUMERIC(5,4),
    strength_of_schedule      NUMERIC(10,2),
    matches_played_90d        INTEGER,
    feature_vector            JSONB
);

CREATE TABLE predictions (
    id                    BIGSERIAL PRIMARY KEY,
    tournament_id         INTEGER REFERENCES tournaments(tournament_id),
    player_id             INTEGER REFERENCES players(player_id),
    model_name             VARCHAR(30),
    model_version           VARCHAR(20),
    round_reached_probs     JSONB,
    win_probability         NUMERIC(6,5),
    expected_placement      NUMERIC(6,2),
    generated_at             TIMESTAMPTZ DEFAULT now(),
    num_simulations           INTEGER
);

CREATE TABLE simulation_runs (
    run_id             BIGSERIAL PRIMARY KEY,
    tournament_id      INTEGER REFERENCES tournaments(tournament_id),
    num_simulations     INTEGER,
    random_seed         BIGINT,
    model_version        VARCHAR(20),
    started_at           TIMESTAMPTZ,
    finished_at          TIMESTAMPTZ,
    status               VARCHAR(20)
);

CREATE INDEX idx_features_tournament ON features(tournament_id);
CREATE INDEX idx_predictions_tournament ON predictions(tournament_id, model_name);
CREATE INDEX idx_matches_tournament ON matches(tournament_id, round_number);
