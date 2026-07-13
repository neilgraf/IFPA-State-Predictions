"""
Client for the IFPA API (https://www.ifpapinball.com/api/documentation/).

Unlike Match Play, IFPA requires an api_key query parameter on every
request. Request one from the documentation link above, then set
IFPA_API_KEY in your .env file.
"""

import os
import requests

BASE_URL = "https://api.ifpapinball.com/v1"


class IFPAClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("IFPA_API_KEY")
        if not self.api_key:
            raise ValueError(
                "No IFPA API key provided. Set IFPA_API_KEY in your "
                "environment or .env file."
            )

    def _get(self, path: str, params: dict | None = None) -> dict:
        params = dict(params or {})
        params["api_key"] = self.api_key
        resp = requests.get(f"{BASE_URL}{path}", params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def get_player(self, ifpa_id: int) -> dict:
        return self._get(f"/player/{ifpa_id}")

    def get_player_results(self, ifpa_id: int) -> dict:
        return self._get(f"/player/{ifpa_id}/results")

    def get_player_rankings_history(self, ifpa_id: int) -> dict:
        return self._get(f"/player/{ifpa_id}/history")


if __name__ == "__main__":
    # Quick manual smoke test: python -m backend.ingestion.ifpa_client <ifpa_id>
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: python -m backend.ingestion.ifpa_client <ifpa_id>")
        sys.exit(1)

    client = IFPAClient()
    data = client.get_player(int(sys.argv[1]))
    print(json.dumps(data, indent=2))
