---
problemNumber: 89
title: 'Roman Numerals'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler89.java'
---

## The problem

A file holds a thousand valid Roman numerals, not all written as compactly as possible. Find the total number of characters saved by rewriting each one in its minimal form.

## My solution

I parse each numeral to an integer, write that integer back out in minimal form, and add up the length differences. A small `Roman` class does both conversions.

**Parsing** goes from right to left. The last symbol is always added. Each earlier symbol is added if it's at least as large as the symbol to its right, and subtracted otherwise, which handles IV, XC and so on. The parser doesn't care about minimality, so non-minimal input like `IIII` or `VIIII` simply adds up.

**Writing** is greedy over 13 tokens: the seven single symbols plus the six subtractive pairs IV, IX, XL, XC, CD and CM. Going from M down, I append a token as many times as it fits:

```java
for(int i = arr.length - 1; i >= 0; i--) {
  while(num >= arr[i].value) {
    roman += arr[i].roman;
    num -= arr[i].value;
  }
}
```

Including the subtractive pairs as their own tokens is what makes the greedy output minimal: 4 becomes IV and not IIII, 900 becomes CM and not DCCCC. The main loop reads the file line by line and adds `original.length() - minimal.length()` to the total.

## Notes

Since only the length matters, the conversion can be skipped: replacing DCCCC, CCCC, LXXXX, XXXX, VIIII and IIII with two-character placeholders and comparing lengths gives the same count.
