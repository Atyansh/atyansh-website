---
problemNumber: 48
title: 'Self Powers'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler48.py'
---

## The problem

Add up nⁿ for every n from 1 to 1000 and report the last ten digits of the total.

## My solution

Python's arbitrary-precision integers make this a short loop: compute each iⁱ exactly, add them all up, and print the result.

```python
sum = 0

i = 1;
while i != 1001:
  sum += i**i
  i+=1

print sum
```

Nothing in the code reduces modulo 10¹⁰. It prints the entire 3,001-digit sum, and the last ten digits are read off the end of the output. It's Python 2 (`print sum` is a statement) and finishes in a few hundredths of a second.

## Notes

The modular version, summing `pow(i, i, 10**10)` and reducing at the end, never builds the huge numbers. At n ≤ 1000 the exact sum is cheap enough that it makes no practical difference.
