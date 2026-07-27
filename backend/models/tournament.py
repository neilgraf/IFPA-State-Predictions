import random
from collections import defaultdict

from backend.models.bracket_definitions import build_bracket, round_labels


class BracketTournament:
    """
    Monte Carlo simulator for a single-elimination, head-to-head bracket of
    any size (16 / 24 / 32 / 64 are the sizes the GUI offers, but anything
    from 2 to 64 works). Fields that aren't a power of two are seeded into
    the next power of two up, with the surplus slots played as byes for the
    top seeds -- that's how a 24-player field becomes a 32-slot bracket where
    seeds 1-8 sit out Round 1.

    It tracks, per simulation, every round each player reaches -- not just
    who ultimately wins. That's what lets the API answer "probability of
    advancing to each round," not just "probability of winning it all."
    """

    def __init__(self, players, slots=None, best_of=7):
        """
        players: dict {seed: Player}
        slots: first-round slot list from build_bracket(); each entry is a
            seed or None for a bye. Defaults to the standard bracket for
            however many players were passed in.
        best_of: games per match (odd); default 7 matches the IFPA state
            championship format
        """
        self.players = players
        self.slots = slots if slots is not None else build_bracket(len(players))
        self.wins_needed = best_of // 2 + 1
        self.round_labels = round_labels(len(self.slots))

        # Seeds that sit out the first round. "Reaching R1" isn't a
        # meaningful stat for them -- it should read as N/A, not a smoothed
        # near-zero.
        self.first_round_byes = {
            (a if b is None else b)
            for a, b in zip(self.slots[::2], self.slots[1::2])
            if (a is None) != (b is None)
        }

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
        """Plays one full bracket, recording each round every player plays in."""
        current = self.slots
        for label in self.round_labels:
            survivors = []
            for seed_a, seed_b in zip(current[::2], current[1::2]):
                if seed_a is None or seed_b is None:
                    # Bye: whoever is present advances without playing, so
                    # this round doesn't count as one they competed in.
                    survivors.append(seed_a if seed_b is None else seed_b)
                    continue
                advancement[seed_a][label] += 1
                advancement[seed_b][label] += 1
                survivors.append(self._play_match(seed_a, seed_b, rng))
            current = survivors

        winner = current[0]
        advancement[winner]["W"] += 1
        return winner

    def run(self, num_simulations=10000, seed=None):
        """Runs the Monte Carlo simulation and returns a list of per-player
        results, sorted by win probability descending."""
        rng = random.Random(seed)
        advancement = {s: defaultdict(int) for s in self.players}

        for _ in range(num_simulations):
            self.simulate_once(rng, advancement)

        # Small floor so a longshot's real-but-rare path doesn't display as a
        # hard 0%, matching the smoothing the original prototype applied to
        # win_probability. Only applied where the round is reachable at all.
        min_probability = 1 / (2 * num_simulations)

        first_round = self.round_labels[0]
        results = []
        for seed_num, counts in advancement.items():
            player = self.players[seed_num]
            round_probs = {}
            for label in self.round_labels:
                if label == first_round and seed_num in self.first_round_byes:
                    round_probs[label] = None  # bye: this round doesn't apply
                else:
                    round_probs[label] = max(
                        counts.get(label, 0) / num_simulations, min_probability
                    )
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
