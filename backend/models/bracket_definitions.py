"""
Bracket topology for the standard 24-player IFPA-style format used by the
WI/OH state datasets: the bottom 16 seeds play into Round 1, and the 8
winners join the top 8 seeds (who received byes) in Round 2. From there
it's standard single elimination: QF -> SF -> F.

This is the exact structure that was hardcoded in the original state.py
simulate_tournament() method, pulled out here as data so BracketTournament
can be reused for any 24-player field with this shape.
"""

# The 8 first-round matches (seeds 9-24)
ROUND1_MATCHUPS_24 = [
    (16, 17), (9, 24), (13, 20), (12, 21),
    (15, 18), (10, 23), (14, 19), (11, 22),
]

# Round 2: each tuple is (bye_seed, index_into_round1_winners).
# e.g. (1, 0) means seed 1 plays the winner of ROUND1_MATCHUPS_24[0].
ROUND2_TEMPLATE_24 = [
    (1, 0), (8, 1), (4, 2), (5, 3),
    (2, 4), (7, 5), (3, 6), (6, 7),
]
