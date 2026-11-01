---
problemNumber: 46
title: "Goldbach's Other Conjecture"
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler46.java'
---

## The problem

Goldbach guessed that every odd composite number is a prime plus twice a perfect square. Find the smallest odd composite for which that fails.

## My solution

A straight search upward through the odd numbers, starting at 11. Primality is trial division by odd numbers up to √n (enough, since only odd n are ever tested), and every prime found is appended to a list. So when an odd composite n comes up, the list already holds every prime below it.

For each prime p in the list, the code steps j = 1, 2, 3, … until p + 2j² reaches or passes n. Landing exactly on n means n fits the conjecture and the search moves on. If no prime works, n is the counterexample and gets printed.

```java
j = 1;
sum = prime + 2*j*j;

while(sum < i) {
  j++;
  sum = prime + 2*j*j;
}

if(sum == i)
  continue a;
```

This is brute force: for each composite it can try every smaller prime, each with up to √(n/2) squares. The counterexample is small enough that it doesn't matter. (The prime 2 sits in the list too, but 2 + 2j² is always even, so it never matches.)
