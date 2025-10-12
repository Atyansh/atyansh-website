---
problemNumber: 66
title: 'Diophantine Equation'
difficulty: 25
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler66.py'
---

## Problem Statement

Consider quadratic Diophantine equations of the form:

x² - Dy² = 1

For example, when D=13, the minimal solution in x is 649² - 13×180² = 1.

It can be assumed that there are no solutions in positive integers when D is square.

By finding minimal solutions in x for D = {2, 3, 5, 6, 7}, we obtain the following:

- 3² - 2×2² = 1
- 2² - 3×1² = 1
- 9² - 5×4² = 1
- 5² - 6×2² = 1
- 8² - 7×3² = 1

Hence, by considering minimal solutions in x for D ≤ 7, the largest x is obtained when D=5.

Find the value of D ≤ 1000 in minimal solutions of x for which the largest value of x is obtained.

## Approach

The solution involves:
1. Using continued fractions for √D to find solutions (Pell's equation)
2. Computing convergents of the continued fraction
3. Testing each convergent to see if it satisfies x² - Dy² = 1
4. Finding the D ≤ 1000 that produces the largest minimal x
5. Using BigInteger to handle very large x values
