"""
Bracket topology for single-elimination, head-to-head fields of any size.

Every bracket is a power-of-two tree. A field that isn't a power of two (24
being the IFPA state-championship case) is placed into the next power of two
up, and the surplus slots become byes for the top seeds.

`build_bracket(24)` reproduces exactly the structure that was previously
hardcoded here as ROUND1_MATCHUPS_24 / ROUND2_TEMPLATE_24: seeds 9-24 play
into Round 1, and the 8 winners meet the top 8 seeds in Round 2.
"""

# Field sizes the setup GUI offers. Any size >= 2 works; these are just the
# presets.
SUPPORTED_SIZES = [16, 24, 32, 64]

MAX_PLAYERS = 64


def seeding_order(bracket_size):
    """
    Standard single-elimination seeding order for a power-of-two bracket.

    Returns a flat list of seeds where consecutive pairs are first-round
    matches, ordered so the top two seeds can only meet in the final:

        seeding_order(8) -> [1, 8, 4, 5, 2, 7, 3, 6]
    """
    order = [1]
    while len(order) < bracket_size:
        round_size = len(order) * 2
        expanded = []
        for seed in order:
            expanded.append(seed)
            expanded.append(round_size + 1 - seed)
        order = expanded
    return order


def bracket_size_for(num_players):
    """Smallest power of two that can hold num_players."""
    size = 2
    while size < num_players:
        size *= 2
    return size


def build_bracket(num_players):
    """
    Returns the first-round slot list for a field of num_players.

    The list is in bracket order and its length is a power of two. Each entry
    is either a seed number or None, where None marks a bye -- the player in
    the adjacent slot advances to round 2 without playing.
    """
    if num_players < 2:
        raise ValueError("a bracket needs at least 2 players")
    if num_players > MAX_PLAYERS:
        raise ValueError(f"a bracket supports at most {MAX_PLAYERS} players")

    size = bracket_size_for(num_players)
    return [seed if seed <= num_players else None for seed in seeding_order(size)]


def round_labels(bracket_size):
    """
    Names for each round of a bracket, in playing order.

    The last three rounds are always QF/SF/F; anything earlier is numbered
    from the start, which is how brackets with byes are normally described
    (a 24-player field plays "Round 1" then "Round 2" then quarterfinals).

        round_labels(32) -> ["R1", "R2", "QF", "SF", "F"]
        round_labels(16) -> ["R1", "QF", "SF", "F"]
    """
    total_rounds = bracket_size.bit_length() - 1
    tail = ["QF", "SF", "F"][-min(total_rounds, 3):]
    lead = [f"R{i + 1}" for i in range(total_rounds - len(tail))]
    return lead + tail
