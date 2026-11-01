---
problemNumber: 26
title: 'Reciprocal Cycles'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler26.java'
---

## The problem

Among denominators d < 1000, find the one for which the decimal expansion of 1/d has the longest repeating cycle.

## My solution

Long division with remainder tracking, for every d from 2 to 999. Starting from a remainder of 1, I multiply by 10 until it is at least d, take the remainder mod d, and add it to a `TreeSet`. A remainder of 0 means the decimal terminates, so d is skipped. A remainder already in the set means the digits are about to repeat, and the size of the set is the program's measure of the cycle length.

```java
while(true) {
  while(a - i < 0)
    a *= 10;
  if(a % i == 0)
    continue outer;
  if(!remainders.add(a%i)) {
    if(max < remainders.size()) { max = remainders.size(); d = i; }
    continue outer;
  }
  a = a % i;
}
```

There are only d − 1 possible non-zero remainders, so each d takes at most d steps and the whole search is under a million set operations.
