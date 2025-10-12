---
problemNumber: 1
title: 'Multiples of 3 or 5'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler1.java'
---

# Problem 1: Multiples of 3 or 5

## Problem Statement

If we list all the natural numbers below 10 that are multiples of 3 or 5, we get 3, 5, 6 and 9. The sum of these multiples is 23.

**Find the sum of all the multiples of 3 or 5 below 1000.**

## Approach

This problem can be solved using two approaches:

### Brute Force Approach
Iterate through all numbers from 1 to 999 and check if each number is divisible by 3 or 5. If so, add it to the sum.

```java
int sum = 0;
for (int i = 1; i < 1000; i++) {
    if (i % 3 == 0 || i % 5 == 0) {
        sum += i;
    }
}
```

### Mathematical Approach (More Efficient)
Use the arithmetic series formula to calculate the sum of multiples directly:
- Sum of multiples of 3 below 1000
- Plus sum of multiples of 5 below 1000
- Minus sum of multiples of 15 below 1000 (to avoid double counting)

The sum of multiples of n below limit = n × (1 + 2 + 3 + ... + k) where k = floor((limit-1)/n)

## Complexity

- **Time Complexity**: O(n) for brute force, O(1) for mathematical approach
- **Space Complexity**: O(1)

## Solution

View the complete solution on [GitHub](https://github.com/atyansh/Project-Euler/blob/master/Euler1.java).

## Related Concepts

- Modular arithmetic
- Arithmetic series
- Set theory (inclusion-exclusion principle)
