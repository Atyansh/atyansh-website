---
problemNumber: 60
title: 'Prime Pair Sets'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler60.java'
---

## The problem

The primes 3, 7, 109 and 673 have the property that concatenating any two of them, in either order, gives another prime. Find the smallest sum of a set of five primes with that property.

## My solution

A depth-first backtracking search. It takes the first 1,230 odd primes (3 up to 10,009; 2 can't be in a set because anything ending in 2 is even) and fills a five-slot array one level at a time. At each level it tries primes in order and only recurses when the new prime concatenates to a prime both ways with every prime already chosen. The first time all five slots are filled, the search stops and prints the sum.

```java
for(int j = 0; j < offset; j++) {
  if(!isPrime(set[j] + "" + set[offset]) ||
     !isPrime(set[offset] + "" + set[j]))
    continue x;
}

if(pairSet(primes, set, num, offset + 1))
  return true;
```

Each concatenation test builds the string, parses it as a `long` (at most ten digits here), and runs trial division by odd numbers up to its square root.

## Notes

- Two parts of this are assumptions rather than guarantees. Nothing in the code justifies the cap of 1,230 primes, and the search returns the *first* complete set it reaches, not the one with the smallest sum. Both happen to work out: over these primes, the first set found is also the minimum-sum set.
- Each level's loop starts at index `offset` instead of just past the prime chosen at the previous level, so the search visits the same sets many times in different orders. A prime can't pair with itself (the concatenation pp is divisible by p), so duplicates get rejected, but starting each level after the previous pick would cut most of the redundant work.
