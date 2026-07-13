"""
Player datasets for known 24-player brackets.

These are the same rosters that were hardcoded in the original state.py
prototype, moved here so they can be reused by both generate_predictions.py
and any future ingestion pipeline that replaces them with live MatchPlay/IFPA
data.
"""

from backend.models.player import Player

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
    Player("Peter Goeben", 1569, 24),
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
    Player("Matt E Owen", 1556, 24),
]

New_WI_players_24 = [
    Player("Nathan Zalewski", 1771, 1),
    Player("Erik Thoren", 1671, 2),
    Player("Neil Graf", 1779, 3),
    Player("Tom Graf", 1699, 4),
    Player("Steven Bowden", 1698, 5),
    Player("Matt McCarty", 1646, 6),
    Player("Danny Bronny", 1638, 7),
    Player("David Daluga", 1726, 8),
    Player("Eric Strangeway", 1628, 9),
    Player("Mike Weyenberg", 1679, 10),
    Player("Ryan Eggers", 1647, 11),
    Player("Kassidy Milanowski", 1699, 12),
    Player("Ryan Spindler", 1721, 13),
    Player("Mike Carlson", 1603, 14),
    Player("Tom Schmidt", 1597, 15),
    Player("Drew Geigel", 1673, 16),
    Player("Tom Menge", 1626, 17),
    Player("Timothy Enders", 1617, 18),
    Player("Jordan Semrow", 1714, 19),
    Player("Joe DeCleene", 1580, 20),
    Player("True Garlynd", 1666, 21),
    Player("Trae Vance", 1643, 22),
    Player("Buck Bauer", 1584, 23),
    Player("Jordan Cappaert", 1557, 24),
]

DATASETS = {
    "wi": WI_players_24,
    "oh": OH_players_24,
    "new_wi": New_WI_players_24,
}
