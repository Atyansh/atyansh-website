---
problemNumber: 23
title: 'Non-Abundant Sums'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler23.java'
---

## The problem

A number is abundant if its proper divisors add up to more than the number itself. Every integer above 28123 is known to be a sum of two abundant numbers; the task is to add up all the positive integers that are not.

## My solution

One pass over 1 … 28122 does two jobs at once. For each `i` I sum its proper divisors by trial division up to √i (adding both `j` and `i/j`, but only once when `j` is the exact square root), and if the sum exceeds `i` I append `i` to a list of abundant numbers. Because the list grows in increasing order, by the time I reach `i` it already holds every abundant number that could appear in a sum equal to `i`.

`abundantSum(i)` then checks whether `i` is a sum of two of them. For each abundant number from the small end, it walks down from the large end until the pair sum drops below `i`:

```java
for(int i = 0; i < size; i++) {
  for(int j = size-1; j >= i; j--) {
    if((arr[i] + arr[j]) < n)
      break;
    else if((arr[i] + arr[j]) == n)
      return true;
  }
}
```

Anything that fails the check is added to the total. The loop stops at 28122, which is fine because 28123 itself is a sum of two abundant numbers.

This is the slow part of the program. The `break` only leaves the inner loop, so for a number that is *not* representable the scan touches nearly every pair. Modelling the loop in Python, that comes to about 3.7 × 10⁸ pair sums across the ~1,500 non-representable numbers. `abundantSum` also copies the whole linked list into a fresh array on every call.

## Notes

The usual faster approach inverts the check: add every pair of the ~7,000 abundant numbers once, mark the sums in a boolean array, and total the unmarked indices.
