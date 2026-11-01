---
problemNumber: 5
title: 'Smallest Multiple'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler5.java'
---

## The problem

Find the smallest positive number that every integer from 1 to 20 divides evenly, i.e. lcm(1, 2, …, 20).

## My solution

I worked this out by hand and the program just prints the product:

```java
System.out.println(2*2*2*2*3*3*5*7*11*13*17*19);
```

The LCM of a range is the product of the highest power of each prime that fits in the range. For primes up to 20, those powers are 2⁴ = 16 (since 2⁵ = 32 > 20), 3² = 9 (since 3³ = 27 > 20), and the first power of 5, 7, 11, 13, 17 and 19. Every number from 1 to 20 factors into primes with exponents no bigger than these, so it divides the product, and no smaller number works because each of those prime powers is itself in the range.
