---
problemNumber: 43
title: 'Sub-string Divisibility'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler43.java'
---

## The problem

Consider the 0–9 pandigital numbers d₁d₂…d₁₀. Find the sum of those where each three-digit window d₂d₃d₄, d₃d₄d₅, …, d₈d₉d₁₀ is divisible by 2, 3, 5, 7, 11, 13 and 17 respectively.

## My solution

Brute force over permutations, reusing the next-permutation function from [problem 24](/euler/24) (`Euler24.next`, so `Euler24.java` has to be compiled alongside). Starting from 1023456789, the smallest pandigital without a leading zero, I step through every permutation up to 9876543210, about 3.3 million of them (9 × 9!). For each one I parse the seven windows with `Integer.parseInt` and test divisibility, moving on at the first failure; survivors are added to the sum.

```java
for(int i = 0; i < 7; i++) {
  num = Integer.parseInt(""+arr[i+1]+arr[i+2]+arr[i+3]);
  if(num % primes[i] != 0)
    continue loop;
}
```

Every permutation is generated and checked, and most are ruled out quickly: about half fail the very first window, which needs d₄ to be even.
