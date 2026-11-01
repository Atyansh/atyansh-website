---
problemNumber: 24
title: 'Lexicographic Permutations'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler24.java'
---

## The problem

List all permutations of the digits 0–9 in lexicographic order and find the millionth one.

## My solution

I start from `0123456789` (the first permutation) and apply a hand-written next-permutation step 999,999 times.

`next(arr, index)` is recursive. Starting from the last position it moves left while the digits are non-increasing, which skips over the longest descending suffix. At the first position where `arr[index-1] < arr[index]`, it finds the smallest digit in the suffix that is larger than `arr[index-1]`, swaps the two, and sorts the suffix back into ascending order. The swap is done arithmetically on the chars rather than with a temporary:

```java
if(i2 != Integer.MAX_VALUE) {
  arr[index-1] += min;
  arr[i2] -= min;
}
...
Arrays.sort(arr, index, arr.length);
```

This is the classic next-permutation algorithm, except that it sorts the suffix where the textbook version reverses it (the suffix is at most 10 chars, so it doesn't matter). A million steps of that is trivial.

The `index == 0` base case was added in a later commit ("Helpful for Euler 49"), so calling `next` on the final, fully descending permutation returns instead of reading `arr[-1]`. Problem 43 also reuses `Euler24.next`.

## Notes

The millionth permutation can also be computed directly: 9! permutations start with each leading digit, so dividing 999,999 by 9!, 8!, … in turn picks the digits one at a time.
