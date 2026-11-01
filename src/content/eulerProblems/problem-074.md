---
problemNumber: 74
title: 'Digit Factorial Chains'
difficulty: 15
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler74.java'
---

## The problem

Repeatedly replace a number with the sum of the factorials of its digits. Every start eventually runs into a loop. Count the starting numbers below one million whose chain has exactly 60 distinct terms before the first repeat.

## My solution

Straight simulation. For every start from 1 to 999,999, I keep a `HashSet` of the values seen so far and step the chain until the next value is already in the set. The set's size is then the number of non-repeating terms:

```java
while(!set.contains(value)) {
  set.add(value);

  long sum = 0;
  while(value != 0) {
    sum += digitFactorial((int) value % 10);
    value = value / 10;
  }

  value = sum;
}

if(set.size() == 60)
  answer++;
```

The digit factorials 0! to 9! are computed once into constants (with a small recursive `factorial`), and `digitFactorial` picks one with a `switch`. Values never get larger than 7 × 9! = 2,540,160, so the `long`s are more than enough.

The problem statement guarantees that no chain from a start below one million is longer than 60 terms, so the work is bounded by about 60 million steps plus a fresh `HashSet` per start.

## Notes

The next term doesn't depend on digit order, so all rearrangements of a start's digits share every term after the first.
