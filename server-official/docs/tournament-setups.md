# Tournament Setups

The tournament system can be set up with round-robin-style schedules
and a fixed number of players and rounds.

There is no support for elimination or swiss tournaments.

# Knapsack

If organizing a large tournament where you need to split players into multiple groups,
you can use the coin-change knapsack algorithm to create the pools. If you choose the
pool sizes carefully, you can still make each pool play the same number of rounds even
though they are of different sizes.

* Group size 3/4 (from 6 players and up)
* Group size 3/5 (from 8 players and up)
* Group size 4/5 (from 12 players and up)
* Group size 4/7 (from 18 players and up)
* Group size 5/9 (from 32 players and up)
* Group size 3/4/5 (for symmetric games with a variable number of players)

# 2-player

The 2-player scheduling is a basic round-robin using Berger tables where
everybody faces everybody else once (or twice if the number of rounds is
doubled).

For balanced play of asymmetric games, it's recommended to play an even number
of rounds -- so schedule an odd number of players or an even number of players
with double rounds.

In round robin scheduling for an odd number of players, one player in each
round will traditionally get a "bye". When playing online, having a player sit
out a round isn't very nice, but we can schedule multiple games simultaneously.

There is no need to use sequential scheduling for 2p games. The system ensures
a player will not play the same role/color in more than one game at a time per
tournament, even when scheduling games for concurrent rounds.

## Odd number of players

* 3 players, 4 rounds (doubled)
* 5 players, 4 rounds
* 7 players, 6 rounds
* 9 players, 8 rounds

Sequential scheduling has one player sit out each round.

Concurrent scheduling has two matches per round (playing both sides simultaneously).

To play all matches at once, set stagger to zero days.

## Even number of players

* 4 players, 3 rounds or 6 rounds (doubled)
* 6 players, 5 rounds or 10 rounds (doubled)
* 8 players, 7 rounds
* 10 players, 9 rounds

Concurrent scheduling puts all matches in one round.

# Multi-player

The 3/4/5-player game scheduling is based on using Youden squares or Resolvable
Balanced Incomplete Block Designs (RBIBD). To read more about this, search for
Kirkman's schoolgirl problem and the social golfer problem.

You can of course use the sequential schedules to play concurrently,
but vice-versa does not work as well.

## Concurrent (Youden square)

For concurrent play, a Youden square design will ensure everybody plays everybody
else evenly, and also play each role/color evenly. This particular design unfortunately
requires that you play multiple games at once to avoid players having no games in some rounds.

* For 3p, you need 7 players to meet everybody once in 3 matches.
* For 4p, you need 13 players to meet everybody once in 4 matches.
* For 4p, you need 7 players to meet everybody twice in 4 matches.
* For 5p, you need 21 players to meet everybody once in 5 matches.
* For 5p, you need 11 players to meet everybody twice in 5 matches.
* For 6p, you need 31 players to meet everybody once in 6 matches.
* For 6p, you need 11 players to meet everybody thrice in 6 matches.

In sequential schedules, the matches are batched into rounds so that everybody
has at least one game going, and some players multiple.

> For example, here's the concurrency table for 3p sequential play:
>
> * Round 1: 1,2,2,3,2,1,1
> * Round 2: 2,1,1,0,1,2,2
>
> One player has 3 games in round one, and 0 games in round two;
> three players have 2 games, then 1 game; and the last three players have 1 game, then 2 games.

## Concurrent (BIBD)

There are a few irregular block designs that work very well for concurrent play.
These all have perfect incidence matrices: everybody meets everybody else evenly,
and plays each side the same number of times.

These designs also work well for sequential-ish play with few concurrent
matches per round.

* 3p -- 13 players meet 1x in 6 rounds
* 4p -- 9 players meet 3x in 8 rounds
* 6p -- 16 players meet 2x in 6 rounds

## Sequential (RBIBD)

For sequential play there are a few block designs where you can face every
other player once, or play each role/color evenly. Unfortunately you cannot do
both! The options are to either miss one round (so not meeting 2 opponents in a 3p
tournament, or 3 opponents in a 4p tournament) or to play an extra round
(repeating a color/role).

For asymmetric games, it's better to miss a round!

For 3p games using Steiner Triple Systems:

* RBIBD(9,3,1) -- 9 players, 3 or 4 rounds
* RBIBD(15,3,1) -- 15 players, 6 or 7 rounds
* RBIBD(21,3,1) -- 21 players, 9 or 10 rounds
* etc.

For 4p games using Steiner Quadruple Systems:

* RBIBD(16,4,1) -- 16 players, 4 or 5 rounds
* RBIBD(28,4,1) -- 28 players, 8 or 9 rounds
* etc.

For 5p games:

* RBIBD(25,5,1) -- 25 players, 5 or 6 rounds

## Sequential (Social Golfer)

There are some imperfect block designs that can work well for scheduling
sequential play. These either miss certain pairings, or repeat some pairings
more often than others.

* 3p -- 6 players, 3 rounds (missed pairings)
* 3p -- 12 players, 4 rounds (missed pairings)
* 4p -- 8 players, 4 rounds (missed pairings)
* 4p -- 8 players, 5 rounds (repeated pairings)

