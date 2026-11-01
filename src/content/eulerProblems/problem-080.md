---
problemNumber: 80
title: 'Square Root Digital Expansion'
difficulty: 20
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler80.py'
---

## The problem

For each of the first hundred natural numbers whose square root is irrational, add up the first 100 digits of that square root (counting the integer part). Report the total.

## My solution

I compute the digits with the longhand, digit-by-digit square root method from school, using Python's arbitrary-precision integers. For each non-square i from 2 to 99, I start with r = ⌊√i⌋ and a remainder of (i − r²) followed by "00". Then, 99 times:

1. Double the root found so far to get p.
2. Find the largest digit k with (10p + k) · k below the remainder.
3. Append k to the root, subtract, and bring down two more zeros.

```python
for j in range(0, 99):
  sqrt = int(answer) * 2
  k = 9
  while k >= 0:
    sq = int(str(sqrt) + str(k)) * k
    if sq < n:
      sqrt = int(str(sqrt) + str(k))
      break
    k -= 1

  answer += str(k)
  n -= sq
  n = int(str(n)+"00")
```

The root is kept as a string. Multiplying by 10 and adding k, or "bringing down" two zeros, is done by string concatenation followed by `int(...)`. One integer digit plus 99 decimal digits makes the 100 digits that get summed. Looping over 2 to 99 and skipping the perfect squares covers every irrational root among the first hundred numbers, since 1 and 100 are squares themselves.
