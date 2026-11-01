---
problemNumber: 31
title: 'Coin Sums'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler31.java'
---

## The problem

Count the number of different ways to make £2 (200p) from the eight UK coins: 1p, 2p, 5p, 10p, 20p, 50p, £1 and £2.

## My solution

A recursive count. `counter(coins, index, target)` decides how many of `coins[index]` (the largest coin still allowed) to use, then recurses on the remaining amount with only the smaller coins. When only the 1p coin is left there is exactly one way to finish, which is the base case.

```java
if(index == 0)
  return 1;

while(sum < target)
  sum += coins[index];

if(sum == target)
  count++;

while(sum > 0) {
  sum -= coins[index];
  count += counter(coins, index - 1, target - sum);
}
```

The first loop finds the smallest multiple of the coin that is at least the target. If it lands exactly on the target, that's the "pay entirely in this coin" way, counted directly. The second loop then steps down through every smaller multiple, from the most coins that fit down to zero, and recurses on whatever is left. Every leaf of the recursion is one way of paying, so the work is proportional to the answer, which is small enough to be instant.
