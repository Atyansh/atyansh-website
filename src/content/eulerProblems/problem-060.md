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
