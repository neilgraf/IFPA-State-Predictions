"""
Merges player identities across Match Play and IFPA.

Match Play user/player objects already carry an `ifpaId` field, so
resolving identity doesn't require fuzzy name-matching -- just upsert on
that field. This module assumes a Postgres connection (e.g. psycopg2 /
psycopg) matching the schema in backend/db/schema.sql; adapt the `db`
parameter to whatever client you're using.
"""


def resolve_and_upsert_player(db, matchplay_player: dict) -> int:
    """
    matchplay_player: a Match Play player/user object, expected to contain
    at least `ifpaId`, `userId` (or `playerId`), and `name`.

    Returns the internal players.player_id, inserting a new row if this
    player hasn't been seen from either source before.
    """
    ifpa_id = matchplay_player.get("ifpaId")
    matchplay_user_id = matchplay_player.get("userId") or matchplay_player.get("playerId")
    name = matchplay_player.get("name")

    existing = db.execute(
        "SELECT player_id FROM players WHERE ifpa_id = %s OR matchplay_user_id = %s",
        (ifpa_id, matchplay_user_id),
    ).fetchone()
    if existing:
        return existing.player_id

    inserted = db.execute(
        """
        INSERT INTO players (display_name, ifpa_id, matchplay_user_id)
        VALUES (%s, %s, %s)
        RETURNING player_id
        """,
        (name, ifpa_id, matchplay_user_id),
    ).fetchone()
    return inserted.player_id
