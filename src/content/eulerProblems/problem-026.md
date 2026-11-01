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

Long division with remainder tracking, for every d from 2 to 999. Starting from a remainder of 1, I multiply by 10 until it is at least d, take the remainder mod d, and add it to a `TreeSet`. A remainder of 0 means the decimal terminates, so d is skipped. A remainder already in the set means the digits are about to repeat, and the set's size is taken as the cycle length.

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

## Notes

The set size isn't exactly the cycle length. When a remainder is small, the inner `while` multiplies by 10 more than once, and the remainders in between (the ones that produce a 0 digit) never get recorded. So the code really counts the non-zero digits in the cycle, plus a pre-period remainder or two when d has factors of 2 or 5. For 1/101 = 0.(0099) it reports 2 instead of 4. I modelled the loop in Python: this measure differs from the true period for 881 of the 998 denominators, but its maximum is at the same d, so the answer comes out right. Counting multiply-by-10 steps instead of set entries would give the exact length.
