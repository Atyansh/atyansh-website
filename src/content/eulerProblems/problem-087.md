---
problemNumber: 87
title: 'Prime Power Triples'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler87.java'
---

## The problem

Count the numbers below fifty million that can be written as p² + q³ + r⁴ for primes p, q and r.

## My solution

The square term is the one that limits the prime size: p² < 50,000,000 means p < √(5 × 10⁷) ≈ 7071.07. So I get the primes up to 7072 from my shared `PrimeGenerator` helper, which checks each odd number by trial division up to its square root. That gives 908 primes.

Then three nested loops go over the same sorted list for the square, cube and fourth-power terms. Each loop breaks as soon as its partial sum passes the limit, so the inner loops are short: cubes stop around q ≈ 370 and fourth powers around r ≈ 84. Some numbers have more than one representation, so the sums go into a `HashSet<Integer>`, and only successful inserts are counted:

```java
int cSum = bSum + c*c*c*c;

if(cSum > limit)
  break;

if(set.add(cSum))
  answer++;
```

That comes to about 1.14 million candidate sums, of which about 42,000 are duplicates.

## Notes

- `b*b*b` is `int` arithmetic and would overflow for primes above 1290. It's safe only because the loop breaks long before that.
- The break uses `> limit`, so a sum of exactly 50,000,000 would be counted even though the problem says "below". It doesn't matter here: 50,000,000 has no such representation.
