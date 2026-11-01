---
problemNumber: 58
title: 'Spiral Primes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler58.java'
---

## The problem

Write the integers in an anticlockwise square spiral outward from 1 (the same spiral as Problem 28, turned the other way). As layers are added, find the side length at which fewer than 10% of the numbers on the two diagonals are prime.

## My solution

The corners are generated on the fly instead of building the grid. On a layer with odd side length s, consecutive corners are s − 1 apart, continuing from the previous layer's last corner. The code adds s − 1 four times per layer and tests the first three corners for primality. The fourth corner is s², which is never prime, so it is skipped. The diagonal count grows by 4 per layer, and the loop stops at the first layer where primes/total drops below 0.1.

```java
side += 2;
total += 4;

for(int i = 0; i < 3; i++) {
  num += (side - 1);
  if(isPrime(num))
    prime++;
}

num += (side - 1);
```

Primality is trial division by odd numbers up to √n. The corners stay below 2³¹ for the side lengths this reaches, so plain `int` is enough.
