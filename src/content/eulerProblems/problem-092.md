---
problemNumber: 92
title: 'Square Digit Chains'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler92.java'
---

# Problem 92: Square Digit Chains

## Problem Statement

A number chain is created by continuously adding the square of the digits in a number to form a new number until it has been seen before.

For example:
- 44 → 32 → 13 → 10 → 1 → 1
- 85 → 89 → 145 → 42 → 20 → 4 → 16 → 37 → 58 → 89

Therefore any chain that arrives at 1 or 89 will become stuck in an endless loop. What is most amazing is that EVERY starting number will eventually arrive at 1 or 89.

**How many starting numbers below ten million will arrive at 89?**

## Approach

This problem requires simulating the square digit chain process for many numbers. The key insight is that we can optimize using memoization.

### Brute Force Approach
For each number from 1 to 10,000,000:
1. Calculate the sum of squares of its digits
2. Repeat until reaching 1 or 89
3. Count how many numbers arrive at 89

### Optimized Approach with Memoization
Since many numbers will share the same intermediate values in their chains, we can cache results:
1. Create a lookup table to store which destination (1 or 89) each number reaches
2. For each number, follow the chain until we either:
   - Reach 1 or 89 directly
   - Reach a number we've already computed
3. Backfill the cache with all numbers in the current chain

Additional optimization: The sum of squares of digits of any number below 10,000,000 is at most:
- 9² × 7 = 567 (for 9,999,999)

So we only need to compute chains for numbers up to 567 initially, then use this cache for larger numbers.

## Complexity

- **Time Complexity**: O(n × d) where n is the upper limit and d is the average chain length, reduced significantly with memoization
- **Space Complexity**: O(n) for the memoization cache

## Solution

View the complete solution on [GitHub](https://github.com/atyansh/Project-Euler/blob/master/Euler92.java).

## Related Concepts

- Dynamic programming
- Memoization
- Digit manipulation
- Chain sequences
- Cycle detection
