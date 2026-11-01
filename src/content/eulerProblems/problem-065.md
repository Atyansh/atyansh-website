---
problemNumber: 65
title: 'Convergents of e'
difficulty: 15
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler65.py'
---

## The problem

The continued fraction of e is [2; 1, 2, 1, 1, 4, 1, 1, 6, 1, …]. Find the sum of the digits in the numerator of its 100th convergent.

## My solution

Instead of the usual forward recurrence for convergents, the code evaluates the truncated continued fraction from the bottom up. The 100th convergent uses a₀ = 2 followed by 99 more terms, which form 33 blocks of (1, 2k, 1) for k = 1 to 33. The current value is held as den/num, and each step replaces it with a + num/den:

```python
temp = c*den+num
num = den
den = temp
```

It starts from the innermost term (the final 1), applies the 66 and the 1 before it by hand, then loops 32 times over the remaining (1, c, 1) blocks with c dropping by 2 each time, and finishes by adding a₀ = 2. The digit sum is taken from the final numerator. Each step keeps the fraction in lowest terms (gcd(a·den + num, den) = gcd(num, den)), so no reduction is needed, and Python's integers handle the size. The hard-coded 66 and 32 tie the script to the 100th convergent specifically. It runs instantly.
