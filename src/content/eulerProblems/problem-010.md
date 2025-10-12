---
problemNumber: 10
title: 'Summation of Primes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler10.java'
---

# Problem 10: Summation of Primes

## Problem Statement

The sum of the primes below 10 is 2 + 3 + 5 + 7 = 17.

**Find the sum of all the primes below two million.**

## Approach

### Sieve of Eratosthenes
The most efficient approach for finding all primes below a given number is the Sieve of Eratosthenes:

1. Create a boolean array of size n, initially all true
2. Mark 0 and 1 as not prime
3. For each number i from 2 to √n:
   - If i is marked as prime
   - Mark all multiples of i (starting from i²) as not prime
4. Sum all numbers that remain marked as prime

```java
boolean[] isPrime = new boolean[2000000];
Arrays.fill(isPrime, true);
isPrime[0] = isPrime[1] = false;

for (int i = 2; i * i < 2000000; i++) {
    if (isPrime[i]) {
        for (int j = i * i; j < 2000000; j += i) {
            isPrime[j] = false;
        }
    }
}

long sum = 0;
for (int i = 2; i < 2000000; i++) {
    if (isPrime[i]) sum += i;
}
```

## Why Sieve of Eratosthenes?

- Trial division would require checking each number individually (too slow)
- Sieve efficiently finds all primes in one pass
- Optimal for finding all primes below a given limit

## Complexity

- **Time Complexity**: O(n log log n)
- **Space Complexity**: O(n)

## Optimization Tips

- Start marking from i² instead of 2i (smaller multiples already marked)
- Only iterate up to √n in the outer loop
- Use long for the sum to avoid integer overflow

## Solution

View the complete solution on [GitHub](https://github.com/atyansh/Project-Euler/blob/master/Euler10.java).

## Related Concepts

- Prime numbers
- Sieve of Eratosthenes algorithm
- Efficient prime generation
- Time-space tradeoffs
