"""
Closed-form odds for a single head-to-head match.

The simulator plays matches game by game (see BracketTournament._play_match).
For *displaying* odds we don't want to simulate -- we want the exact number,
so these functions compute it directly.
"""

from math import comb


def game_win_probability(rating_a, rating_b):
    """Elo: probability A wins a single game against B."""
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def match_win_probability(game_probability, wins_needed):
    """
    Probability A wins a race to `wins_needed` games, given a per-game
    probability.

    A wins the match exactly when they reach `wins_needed` wins before B
    does, which means the final game is always A's last win. If B takes j
    games along the way (j < wins_needed), those j losses can fall in any
    order among the first (wins_needed - 1 + j) games -- hence the binomial
    coefficient. Summing over every j gives the total.

    This is the negative binomial distribution: "how many failures before
    the k-th success".
    """
    if wins_needed < 1:
        raise ValueError("wins_needed must be at least 1")

    loss_probability = 1 - game_probability
    return sum(
        comb(wins_needed - 1 + losses, losses)
        * game_probability ** wins_needed
        * loss_probability ** losses
        for losses in range(wins_needed)
    )


def head_to_head(rating_a, rating_b, best_of):
    """Per-game and per-match odds for A against B in a best-of-N."""
    wins_needed = best_of // 2 + 1
    per_game = game_win_probability(rating_a, rating_b)
    per_match = match_win_probability(per_game, wins_needed)
    return {
        "best_of": best_of,
        "wins_needed": wins_needed,
        "game_probability": per_game,
        "match_probability": per_match,
    }
