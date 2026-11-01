---
problemNumber: 47
title: 'Distinct Primes Factors'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler47.java'
---

## The problem

Find the first of four consecutive integers that each have four distinct prime factors.

## My solution

Brute force with trial division. The search starts at 647, just after the problem's three-number example (644, 645, 646), and checks the window num … num+3 one number at a time. Each number is factored by dividing out all the 2s, then trying odd divisors 3, 5, 7, … and dividing each out completely until nothing is left. The distinct factors go into a `TreeSet`, and its size is the count.

The one shortcut is how the window moves after a failure. If num+i has fewer than four distinct factors, no window containing it can work, so the next window starts at num+i+1 instead of num+1:

```java
if(primes.size() < 4) {
  num = num + i + 1;
  continue a;
}
```
