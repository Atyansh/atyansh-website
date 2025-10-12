---
problemNumber: 97
title: 'Large Non-Mersenne Prime'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler97.py'
---

# Problem 97: Large Non-Mersenne Prime

## Problem Statement

The first known prime found to exceed one million digits was discovered in 1999, and is a Mersenne prime of the form $2^{6972593} - 1$; it contains exactly 2,098,960 digits. Subsequently other Mersenne primes, of the form $2^p - 1$, have been found which contain more digits.

However, in 2004 it was found that a massive non-Mersenne prime exceeds one million digits, which contains 2,357,207 digits: $28433 \times 2^{7830457} + 1$.

**Find the last ten digits of this prime number.**

## Approach

This problem requires computing the last 10 digits of a massive number without calculating the entire number (which would be computationally infeasible given it has over 2 million digits).

### Key Insight: Modular Arithmetic
We only need the last 10 digits, which is equivalent to finding the result modulo $10^{10}$.

Using modular arithmetic properties:
- $(a \times b) \bmod m = ((a \bmod m) \times (b \bmod m)) \bmod m$
- We can compute $2^{7830457} \bmod 10^{10}$ using modular exponentiation

### Modular Exponentiation (Fast Power Algorithm)
Instead of computing $2^{7830457}$ directly, we use binary exponentiation:

```python
def mod_exp(base, exp, mod):
    result = 1
    base = base % mod
    while exp > 0:
        if exp % 2 == 1:
            result = (result * base) % mod
        exp = exp >> 1
        base = (base * base) % mod
    return result
```

### Solution Steps
1. Compute $2^{7830457} \bmod 10^{10}$ using modular exponentiation
2. Multiply by 28433: $(28433 \times 2^{7830457}) \bmod 10^{10}$
3. Add 1: $(28433 \times 2^{7830457} + 1) \bmod 10^{10}$

## Complexity

- **Time Complexity**: O(log n) where n is the exponent, due to binary exponentiation
- **Space Complexity**: O(1)

## Solution

View the complete solution on [GitHub](https://github.com/atyansh/Project-Euler/blob/master/Euler97.py).

## Related Concepts

- Modular arithmetic
- Modular exponentiation (fast power algorithm)
- Binary exponentiation
- Number theory
- Mersenne primes
- Large number computation
