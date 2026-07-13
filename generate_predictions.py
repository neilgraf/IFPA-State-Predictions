"""
Runs the Monte Carlo bracket simulation and writes predictions.json, which
backend/server.py serves to the frontend at /api/predictions.

Usage:
    python generate_predictions.py
    python generate_predictions.py --simulations 20000 --dataset oh
    python generate_predictions.py --seed 42          # reproducible output
"""

import argparse
import json
import os

from backend.models.bracket_definitions import ROUND1_MATCHUPS_24, ROUND2_TEMPLATE_24
from backend.models.players_data import DATASETS
from backend.models.tournament import BracketTournament

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "backend", "data", "predictions.json")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--simulations", type=int, default=10000,
                         help="number of Monte Carlo simulations to run (default: 10000)")
    parser.add_argument("--dataset", choices=DATASETS.keys(), default="new_wi",
                         help="which player roster to simulate (default: new_wi)")
    parser.add_argument("--seed", type=int, default=None,
                         help="RNG seed for reproducible results (default: random)")
    parser.add_argument("--out", default=DEFAULT_OUT,
                         help=f"output path (default: {DEFAULT_OUT})")
    args = parser.parse_args()

    players = {p.seed: p for p in DATASETS[args.dataset]}
    tournament = BracketTournament(players, ROUND1_MATCHUPS_24, ROUND2_TEMPLATE_24)
    results = tournament.run(num_simulations=args.simulations, seed=args.seed)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Wrote {len(results)} player predictions to {args.out}\n")
    print("Top 5 by win probability:")
    for r in results[:5]:
        print(f"  {r['name']:<22} {r['win_probability']:.2%} to win the tournament")


if __name__ == "__main__":
    main()
