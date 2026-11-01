---
problemNumber: 54
title: 'Poker Hands'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler54.java'
---

## The problem

A file lists 1,000 deals of two five-card poker hands. Count how many of them player 1 wins under standard hand rankings.

## My solution

A small object model: `Card` parses strings like `TD` into a value (2–14, ace high) and a suit, and `Poker` sorts both hands by value and walks the categories from best to worst: straight flush, four of a kind, full house, flush, straight, three of a kind, two pairs, one pair, high card. At each level, if exactly one player has the category, that player wins. If both do, a tie-break runs. If neither does, it drops to the next level.

Sorting does most of the work. In a sorted hand the middle card `c[2]` always belongs to a four of a kind or three of a kind, so those tie-breaks just compare `c[2]`. Pairs are found by checking fixed adjacent positions, storing the pair value in `p1` (and `p2` for two pairs, swapped so `p1` is the higher). The final fallback, `winner()`, compares cards from highest to lowest. The ace-low straight (A-2-3-4-5) is special-cased. Every category follows the same pattern:

```java
case1 = threeOfAKind(h1);
case2 = threeOfAKind(h2);

if(case1 && case2) {
  if(h1.c[2].value > h2.c[2].value)
    return true;
  else
    return winner();
}
if(case1)
  return true;
if(case2)
  return false;
```

## Notes

Two tie-breaks are wrong. The three-of-a-kind block above shows one: when both players have three of a kind and player 1's is lower, it calls `winner()` and compares high cards instead of returning a loss. The full-house tie-break compares `h1.p1` against `h2.p2` instead of `h2.p1`, though that branch can only run when both hands have the same three-of-a-kind rank, which a single deck rules out. Neither bug affects this file, since no deal in it has both players holding three of a kind.
