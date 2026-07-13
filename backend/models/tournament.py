import random
from collections import defaultdict


class BracketTournament:
    """
    Monte Carlo simulator for a 24-player IFPA-style bracket (16 players in
    Round 1, 8 byes join the Round 1 winners in Round 2, then standard
    single elimination through Quarterfinal -> Semifinal -> Final).

    This generalizes the original state.py Tournament class in one
    important way: it tracks, per simulation, every round each player
    reaches -- not just who ultimately wins. That's what lets the API
    answer "probability of advancing to each round," not just "probability
    of winning the whole thing."
    """

    ROUND_LABELS = ["R1", "R2", "QF", "SF", "F"]

    def __init__(self, players, round1_matchups, round2_template, best_of=7):
        """
        players: dict {seed: Player}
        round1_matchups: list[(seed, seed)] - the first-round matches
        round2_template: list[(bye_seed, round1_match_index)] in bracket
            order, e.g. (1, 0) means seed 1 plays the winner of
            round1_matchups[0]
        best_of: number of games per match (must be odd); default 7
            matches IFPA state championship format
        """
        self.players = players
        self.round1_matchups = round1_matchups
        self.round2_template = round2_template
        self.wins_needed = best_of // 2 + 1

    def _play_match(self, seed_a, seed_b, rng):
        player_a = self.players[seed_a]
        player_b = self.players[seed_b]
        prob_a = player_a.win_probability_against(player_b)
        wins_a = wins_b = 0
        while wins_a < self.wins_needed and wins_b < self.wins_needed:
            if rng.random() < prob_a:
                wins_a += 1
            else:
                wins_b += 1
        return seed_a if wins_a == self.wins_needed else seed_b

    def simulate_once(self, rng, advancement):
        # Round 1
        round1_winners = []
        for seed_a, seed_b in self.round1_matchups:
            advancement[seed_a]["R1"] += 1
            advancement[seed_b]["R1"] += 1
            round1_winners.append(self._play_match(seed_a, seed_b, rng))

        # Round 2 (byes + Round 1 winners)
        round2_matchups = [
            (bye_seed, round1_winners[match_idx])
            for bye_seed, match_idx in self.round2_template
        ]
        round2_winners = []
        for seed_a, seed_b in round2_matchups:
            advancement[seed_a]["R2"] += 1
            advancement[seed_b]["R2"] += 1
            round2_winners.append(self._play_match(seed_a, seed_b, rng))

        # Quarterfinals
        qf_matchups = [
            (round2_winners[i], round2_winners[i + 1])
            for i in range(0, len(round2_winners), 2)
        ]
        qf_winners = []
        for seed_a, seed_b in qf_matchups:
            advancement[seed_a]["QF"] += 1
            advancement[seed_b]["QF"] += 1
            qf_winners.append(self._play_match(seed_a, seed_b, rng))

        # Semifinals
        sf_matchups = [
            (qf_winners[i], qf_winners[i + 1])
            for i in range(0, len(qf_winners), 2)
        ]
        sf_winners = []
        for seed_a, seed_b in sf_matchups:
            advancement[seed_a]["SF"] += 1
            advancement[seed_b]["SF"] += 1
            sf_winners.append(self._play_match(seed_a, seed_b, rng))

        # Final
        seed_a, seed_b = sf_winners
        advancement[seed_a]["F"] += 1
        advancement[seed_b]["F"] += 1
        winner = self._play_match(seed_a, seed_b, rng)
        advancement[winner]["W"] += 1
        return winner

    def run(self, num_simulations=10000, seed=None):
        """Runs the Monte Carlo simulation and returns a list of per-player
        results, sorted by win probability descending."""
        rng = random.Random(seed)
        advancement = {s: defaultdict(int) for s in self.players}

        # Seeds that actually play a Round 1 match (everyone else is a bye
        # straight into Round 2, so "reaching R1" isn't a meaningful stat
        # for them -- it should read as N/A, not a smoothed near-zero).
        round1_seeds = {seed for pair in self.round1_matchups for seed in pair}

        for _ in range(num_simulations):
            self.simulate_once(rng, advancement)

        # Small floor so a longshot's real-but-rare path doesn't display as
        # a hard 0%, matching the smoothing the original prototype applied
        # to win_probability. Only applied where the round is structurally
        # reachable for that player.
        min_probability = 1 / (2 * num_simulations)

        results = []
        for seed_num, counts in advancement.items():
            player = self.players[seed_num]
            round_probs = {}
            for rnd in self.ROUND_LABELS:
                if rnd == "R1" and seed_num not in round1_seeds:
                    round_probs[rnd] = None  # bye: this round doesn't apply
                else:
                    round_probs[rnd] = max(counts.get(rnd, 0) / num_simulations, min_probability)
            round_probs["W"] = max(counts.get("W", 0) / num_simulations, min_probability)
            results.append({
                "name": player.name,
                "seed": seed_num,
                "rating": player.rating,
                "round_probabilities": round_probs,
                "win_probability": round_probs["W"],
            })

        results.sort(key=lambda r: r["win_probability"], reverse=True)
        return results
