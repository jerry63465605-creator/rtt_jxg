# Tournaments

The automated tournaments are managed by the computer.

To play in one of these tournaments, simply register and wait.
Once enough players have joined, the tournaments will kick off automatically.
Make sure you've turned on notifications so you don't miss the start!

If you let a tournament game time out, you will not be allowed to join future tournaments!

## Format

### Rounds

Tournaments are round-robin!
Each player meets every other player (in some 3+ player games there will be some missed or repeated pairings).
In most tournaments you will play each side the same number of times.

* "players" defines how many players will compete in each tournament.
* "matches" defines how many games you will need to play in total.

In tournaments marked "sequential" you will generally play only one game in each round.
For multi-player games you may need to play several games at the same time
in some of the rounds, but this is generally kept to a minimum.

In those marked "concurrent" you will always play multiple games at the same time
in each round (typically one game per side).

See [tournament setups](tournament-setups.md) for technical details on how the rounds are structured.

### Scheduling

The first round starts as soon as there are enough players to create a tournament group.
In case there are players in the queue who have blacklisted each other, there may need to
be more players queued than the "players" setting indicates.

* **Stagger:** The rounds have a staggered start, so that all the matches don't start at the same time.
The second round will start a fixed number of days after the first round has started.
The third round will start the same number of days later again, etc.

* **Deadline:** Games have a maximum duration, and if the deadline is
passed the game will end with a loss for the player who has spent the most
thinking time.

> For example, in a tournament with 7 stagger and 30 deadline:
> round 1 starts immediately and games in round 1 will terminate (if not finished earlier) by day 30;
> round 2 starts on day 7 and will terminate on day 37;
> round 3 starts on day 14 and terminates on day 44.

### Timeouts

If you don't make a move in a game for two weeks, the game will time out with a loss
for you, and all your future games in the same tournament. You'll also be banned from
participating in future tournaments and all your gained tournament tickets will be forfeit.

### Points

Victories are worth 2 points; ties and shared victories are worth 1 point.
The [Sonneborn-Berger](https://en.wikipedia.org/wiki/Sonneborn%E2%80%93Berger_score)
score is used to break ties.

### Levels

Some tournaments have multiple levels. If you win a tournament at one level,
you will gain a few tickets to play in the next level up, and to keep playing
at the same level.

## Mini Cup

This is a small and fast tournament format for casual play.
The mini cup starts as soon as the required number of players have
entered.
You can play in any number of mini cups.

Scenarios are on a monthly rotation.

## Championship

To be done...

## Ladder

To be done...

## User tournaments

To be done...

