import random

class Player:
    def __init__(self, name, rating, seed):
        self.name = name
        self.rating = rating
        self.seed = seed

    def win_probability_against(self, opponent):
        # Elo rating system formula for win probability
        return 1 / (1 + 10 ** ((opponent.rating - self.rating) / 400))

class Tournament:
    def __init__(self, players):
        self.players = {player.seed: player for player in players}

    def simulate_best_of_7_match(self, player1, player2):
        """Simulates a best-of-7 match between two players."""
        wins_player1 = 0
        wins_player2 = 0
        while wins_player1 < 4 and wins_player2 < 4:
            if random.random() < player1.win_probability_against(player2):
                wins_player1 += 1
            else:
                wins_player2 += 1
        return player1 if wins_player1 == 4 else player2

    def simulate_round(self, matchups):
        """Simulates one round of best-of-7 matches based on provided matchups."""
        next_round_winners = []
        for player1_seed, player2_seed in matchups:
            player1 = self.players[player1_seed]
            player2 = self.players[player2_seed]
            winner = self.simulate_best_of_7_match(player1, player2)
            next_round_winners.append(winner.seed)
        return next_round_winners

    def simulate_tournament(self):
        """Simulates the entire tournament based on the defined bracket."""
        round1_matchups = [(16, 17), (9, 24), (13, 20), (12, 21), (15, 18), (10, 23), (14, 19), (11, 22)]
        round1_winners = self.simulate_round(round1_matchups)

        round2_matchups = [(1, round1_winners[0]), (8, round1_winners[1]),
                           (4, round1_winners[2]), (5, round1_winners[3]),
                           (2, round1_winners[4]), (7, round1_winners[5]),
                           (3, round1_winners[6]), (6, round1_winners[7])]
        round2_winners = self.simulate_round(round2_matchups)

        quarterfinal_matchups = [(round2_winners[0], round2_winners[1]),
                                 (round2_winners[2], round2_winners[3]),
                                 (round2_winners[4], round2_winners[5]),
                                 (round2_winners[6], round2_winners[7])]
        quarterfinal_winners = self.simulate_round(quarterfinal_matchups)

        semifinal_matchups = [(quarterfinal_winners[0], quarterfinal_winners[1]),
                              (quarterfinal_winners[2], quarterfinal_winners[3])]
        semifinal_winners = self.simulate_round(semifinal_matchups)

        final_matchup = [(semifinal_winners[0], semifinal_winners[1])]
        final_winner_seed = self.simulate_round(final_matchup)[0]

        return self.players[final_winner_seed]

    def predict_win_probabilities(self, num_simulations=10000):
        """Predicts win probabilities by simulating the tournament multiple times."""
        win_counts = {player.seed: 0 for player in self.players.values()}

        for _ in range(num_simulations):
            winner = self.simulate_tournament()
            win_counts[winner.seed] += 1

        min_probability = 1 / (2 * num_simulations)  # Adjusted to avoid zero probabilities
        probabilities = {
            self.players[seed].name: max(wins / num_simulations, min_probability) for seed, wins in win_counts.items()
        }
        return probabilities

# Define players for the tournament
WI_players_24 = [
    Player("Nathan Zalewski", 1757, 1),
    Player("Neil Graf", 1801, 2),
    Player("Tom Graf", 1659, 3),
    Player("Steven Bowden", 1698, 4),
    Player("Erik Thoren", 1675, 5),
    Player("Kassidy Milanowski", 1701, 6),
    Player("Mike Weyenberg", 1642, 7),
    Player("Danny Bronny", 1632, 8),
    Player("Drew Geigel", 1692, 9),
    Player("David Daluga", 1713, 10),
    Player("Eric Strangeway", 1657, 11),
    Player("Erik Rentmeester", 1638, 12),
    Player("Ryan Eggers", 1688, 13),
    Player("Matt McCarty", 1613, 14),
    Player("Tom Schmidt", 1634, 15),
    Player("Timothy Enders", 1714, 16),
    Player("Holden Milanowski", 1619, 17),
    Player("Trae Vance", 1609, 18),
    Player("Joe DeCleene", 1575, 19),
    Player("Gerald Morrison", 1553, 20),
    Player("Ryan Spindler", 1663, 21),
    Player("Chuck Blohm", 1527, 22),
    Player("Adam VanDynHoven", 1571, 23),
    Player("Peter Goeben", 1569, 24)
]

OH_players_24 = [
    Player("Stephen Prusa", 1728, 1),
    Player("Aaron RIch", 1678, 2),
    Player("Gregory Kennedy", 1876, 3),
    Player("Galvin Morgan", 1780, 4),
    Player("Andrew Lee", 1705, 5),
    Player("Carlos Delaserda", 1791, 6),
    Player("John Delzoppo", 1767, 7),
    Player("Cody Webb", 1683, 8),
    Player("Jesse Baker", 1706, 9),
    Player("Jaden Rich", 1642, 10),
    Player("Brian Shepherd", 1705, 11),
    Player("Jack Nebraska", 1661, 12),
    Player("Mark Brown OH", 1562, 13),
    Player("Preston Currie", 1743, 14),
    Player("Nick Kennedy", 1632, 15),
    Player("Chad Hobbs", 1642, 16),
    Player("Stuart Nyswonger", 1609, 17),
    Player("Rod Lawrence", 1640, 18),
    Player("Adam Krzeminski", 1574, 19),
    Player("Tim Kerro", 1615, 20),
    Player("Tim Breidenstein", 1616, 21),
    Player("Matt Waters", 1600, 22),
    Player("Ken Guenther", 1571, 23),
    Player("Matt E Owen", 1556, 24)
]

# Simulate the 24-player tournament
pinball_tournament = Tournament(WI_players_24)
predicted_probabilities = pinball_tournament.predict_win_probabilities(num_simulations=10000)

# Output the win probabilities for the 24-player bracket
print("24-Player Bracket Predictions:")
for player_name, probability in sorted(predicted_probabilities.items(), key=lambda x: x[1], reverse=True):
    print(f"{player_name}: {probability:.2%} chance of winning")
