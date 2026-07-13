class Player:
    """A single competitor in a tournament, identified by their bracket seed."""

    def __init__(self, name, rating, seed):
        self.name = name
        self.rating = rating
        self.seed = seed

    def win_probability_against(self, opponent):
        """Standard Elo win-probability formula."""
        return 1 / (1 + 10 ** ((opponent.rating - self.rating) / 400))

    def __repr__(self):
        return f"Player({self.name!r}, rating={self.rating}, seed={self.seed})"
