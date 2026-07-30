import random
from collections import defaultdict, namedtuple

from backend.models.bracket_definitions import build_bracket, round_labels

# results:   per-player probabilities, sorted by win probability
# occupancy: per-bracket-position tallies, or None if not tracked
# meta:      how many runs were kept vs attempted (only interesting when
#            a forced scenario caused runs to be rejected)
RunOutcome = namedtuple("RunOutcome", "results occupancy meta")


class ForcedScenarioTooRare(ValueError):
    """Raised when a forced scenario is too unlikely to sample reliably."""


class BracketTournament:
    """
    Monte Carlo simulator for a single-elimination, head-to-head bracket of
    any size (16 / 24 / 32 / 64 are the sizes the GUI offers, but anything
    from 2 to 64 works). Fields that aren't a power of two are seeded into
    the next power of two up, with the surplus slots played as byes for the
    top seeds -- that's how a 24-player field becomes a 32-slot bracket where
    seeds 1-8 sit out Round 1.

    Two things it tracks beyond "who won":

    1. Every round each player reaches, which gives the advancement table.
    2. Optionally, which player occupies each individual bracket *position*,
       which is what lets the UI draw a bracket with "who will probably be
       standing here" in the later rounds.
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
        self.best_of = best_of
        self.round_labels = round_labels(len(self.slots))

        # Seeds that sit out the first round. "Reaching R1" isn't a
        # meaningful stat for them -- it should read as N/A, not a smoothed
        # near-zero.
        self.first_round_byes = {
            (a if b is None else b)
            for a, b in zip(self.slots[::2], self.slots[1::2])
            if (a is None) != (b is None)
        }

    # -- bracket shape ------------------------------------------------

    def match_count(self, round_index):
        """How many match slots exist in a given round (byes included)."""
        return len(self.slots) >> (round_index + 1)

    def playable_matches(self, round_index):
        """
        Indices of matches in a round that are actually contested.

        Only round 0 can contain byes, and a bye isn't a match -- there's
        nobody to force a winner over and nothing to draw.
        """
        if round_index != 0:
            return list(range(self.match_count(round_index)))
        return [
            index
            for index, (a, b) in enumerate(zip(self.slots[::2], self.slots[1::2]))
            if a is not None and b is not None
        ]

    # -- simulation ---------------------------------------------------

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

    def _simulate_path(self, rng, forced):
        """
        Plays one full bracket and returns the seed list for every round,
        plus a final single-entry list holding the champion.

        Returns None if the bracket contradicts `forced` -- that is, a match
        we were told player X wins didn't actually feature X, because X lost
        earlier. Rejecting those runs is what makes the result a genuine
        conditional probability rather than a fudge.
        """
        history = []
        current = self.slots

        for round_index, _ in enumerate(self.round_labels):
            history.append(current)
            survivors = []
            for match_index, (seed_a, seed_b) in enumerate(
                zip(current[::2], current[1::2])
            ):
                if seed_a is None or seed_b is None:
                    survivors.append(seed_a if seed_b is None else seed_b)
                    continue

                forced_winner = forced.get((round_index, match_index)) if forced else None
                if forced_winner is None:
                    survivors.append(self._play_match(seed_a, seed_b, rng))
                elif forced_winner in (seed_a, seed_b):
                    survivors.append(forced_winner)
                else:
                    return None  # this run can't be part of the scenario
            current = survivors

        history.append(current)  # the champion, as a one-entry round
        return history

    def _record(self, history, advancement, occupancy):
        """Folds one accepted simulation into the running tallies."""
        for round_index, label in enumerate(self.round_labels):
            current = history[round_index]

            if occupancy is not None:
                positions = occupancy[round_index]
                for position, seed in enumerate(current):
                    if seed is not None:
                        positions[position][seed] += 1

            # A bye isn't a round you "reached" -- you didn't play it.
            for seed_a, seed_b in zip(current[::2], current[1::2]):
                if seed_a is None or seed_b is None:
                    continue
                advancement[seed_a][label] += 1
                advancement[seed_b][label] += 1

        champion = history[-1][0]
        advancement[champion]["W"] += 1
        if occupancy is not None:
            occupancy[-1][0][champion] += 1

    def _empty_occupancy(self):
        occupancy = []
        width = len(self.slots)
        for _ in self.round_labels:
            occupancy.append([defaultdict(int) for _ in range(width)])
            width //= 2
        occupancy.append([defaultdict(int)])  # champion slot
        return occupancy

    def run(self, num_simulations=10000, seed=None, forced=None,
            track_bracket=False, attempt_budget=200):
        """
        Runs the Monte Carlo simulation.

        forced: {(round_index, match_index): winner_seed}. Runs that
            contradict these are thrown away, so the output is the
            distribution *conditional on* the forced results happening.
        track_bracket: also tally which player holds each bracket position.
        attempt_budget: max attempts per requested simulation before giving
            up on an over-constrained scenario.

        Returns a RunOutcome(results, occupancy, meta).
        """
        rng = random.Random(seed)
        advancement = {s: defaultdict(int) for s in self.players}
        occupancy = self._empty_occupancy() if track_bracket else None

        max_attempts = num_simulations * (attempt_budget if forced else 1)
        kept = attempts = 0

        while kept < num_simulations and attempts < max_attempts:
            attempts += 1
            history = self._simulate_path(rng, forced)
            if history is None:
                continue
            self._record(history, advancement, occupancy)
            kept += 1

        if kept == 0:
            raise ForcedScenarioTooRare(
                f"None of the {attempts:,} attempted brackets matched that "
                "scenario, so its probability can't be estimated. Try forcing "
                "a result in an earlier round, or one involving a stronger seed."
            )

        # Small floor so a longshot's real-but-rare path doesn't display as a
        # hard 0%, matching the smoothing the original prototype applied to
        # win_probability. Only applied where the round is reachable at all.
        min_probability = 1 / (2 * kept)

        first_round = self.round_labels[0]
        results = []
        for seed_num, counts in advancement.items():
            player = self.players[seed_num]
            round_probs = {}
            for label in self.round_labels:
                if label == first_round and seed_num in self.first_round_byes:
                    round_probs[label] = None  # bye: this round doesn't apply
                else:
                    round_probs[label] = max(counts.get(label, 0) / kept, min_probability)
            round_probs["W"] = max(counts.get("W", 0) / kept, min_probability)
            results.append({
                "name": player.name,
                "seed": seed_num,
                "rating": player.rating,
                "round_probabilities": round_probs,
                "win_probability": round_probs["W"],
            })

        results.sort(key=lambda r: r["win_probability"], reverse=True)

        meta = {
            "requested": num_simulations,
            "kept": kept,
            "attempts": attempts,
            "acceptance_rate": kept / attempts,
            "truncated": kept < num_simulations,
        }
        return RunOutcome(results, occupancy, meta)

    # -- bracket view -------------------------------------------------

    def _slot_view(self, counts, kept, top_n):
        """The most likely occupants of one bracket position."""
        ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
        return [
            {
                "seed": seed_num,
                "name": self.players[seed_num].name,
                "rating": self.players[seed_num].rating,
                "probability": count / kept,
            }
            for seed_num, count in ranked[:top_n]
        ]

    def bracket_view(self, occupancy, kept, top_n=4):
        """
        Turns the position tallies into a drawable bracket: rounds, then
        matches, then the two slots of each match with their likeliest
        occupants.
        """
        rounds = []
        for round_index, label in enumerate(self.round_labels):
            positions = occupancy[round_index]
            playable = set(self.playable_matches(round_index))

            matches = []
            for match_index in range(len(positions) // 2):
                if match_index not in playable:
                    continue
                matches.append({
                    "index": match_index,
                    "slots": [
                        self._slot_view(positions[match_index * 2], kept, top_n),
                        self._slot_view(positions[match_index * 2 + 1], kept, top_n),
                    ],
                })

            rounds.append({
                "index": round_index,
                "label": label,
                "matches": matches,
            })

        return {
            "rounds": rounds,
            "champion": self._slot_view(occupancy[-1][0], kept, top_n),
        }
