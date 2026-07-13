"""
Client for the Match Play Events API (https://docs.matchplay.events/api).

Match Play sets a rate limit of roughly 120 requests/min. You must send a
Bearer token on every request or your IP risks being blocked -- generate one
at https://app.matchplay.events/account/tokens.

This module is functional but not wired into anything yet: there's no live
tournament ID configured. To use it for real, set MATCHPLAY_API_TOKEN in a
.env file (see .env.example) and call it from a script or Celery task.
"""

import os
import time
import requests

BASE_URL = "https://app.matchplay.events/api"


class MatchPlayClient:
    def __init__(self, api_token: str | None = None):
        self.api_token = api_token or os.environ.get("MATCHPLAY_API_TOKEN")
        if not self.api_token:
            raise ValueError(
                "No MatchPlay API token provided. Set MATCHPLAY_API_TOKEN "
                "in your environment or .env file."
            )
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_token}",
            "Accept": "application/json",
        })

    def _get(self, path: str, params: dict | None = None) -> dict:
        last_exc = None
        for attempt in range(3):
            try:
                resp = self.session.get(f"{BASE_URL}{path}", params=params, timeout=15)
                if resp.status_code == 429:
                    time.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.RequestException as exc:
                last_exc = exc
                time.sleep(2 ** attempt)
        raise last_exc

    def get_tournament(self, tournament_id: int) -> dict:
        return self._get(f"/tournaments/{tournament_id}")

    def get_tournament_players(self, tournament_id: int) -> list[dict]:
        return self._get(f"/tournaments/{tournament_id}/players")

    def get_tournament_games(self, tournament_id: int) -> list[dict]:
        return self._get(f"/tournaments/{tournament_id}/games")

    def get_user(self, user_id: int, include_ifpa: bool = True) -> dict:
        return self._get(
            f"/users/{user_id}",
            params={"includeIfpa": int(include_ifpa), "includeCounts": 0},
        )


if __name__ == "__main__":
    # Quick manual smoke test: python -m backend.ingestion.matchplay_client <tournament_id>
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: python -m backend.ingestion.matchplay_client <tournament_id>")
        sys.exit(1)

    client = MatchPlayClient()
    data = client.get_tournament(int(sys.argv[1]))
    print(json.dumps(data, indent=2))
