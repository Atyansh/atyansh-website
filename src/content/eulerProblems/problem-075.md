---
problemNumber: 75
title: 'Singular Integer Right Triangles'
difficulty: 25
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler75.py'
---

## Problem Statement

It turns out that 12 cm is the smallest length of wire that can be bent to form an integer sided right angle triangle in exactly one way, but there are many more examples.

- 12 cm: (3,4,5)
- 24 cm: (6,8,10)
- 30 cm: (5,12,13)
- 36 cm: (9,12,15)
- 40 cm: (8,15,17)
- 48 cm: (12,16,20)

In contrast, some lengths of wire, like 20 cm, cannot be bent to form an integer sided right angle triangle, and other lengths allow more than one solution to be found; for example, using 120 cm it is possible to form exactly three different integer sided right angle triangles.

- 120 cm: (30,40,50), (20,48,52), (24,45,51)

Given that L is the length of the wire, for how many values of L ≤ 1,500,000 can exactly one integer sided right angle triangle be formed?

## Approach

The solution involves:
1. Using Euclid's formula to generate Pythagorean triples: a=m²-n², b=2mn, c=m²+n²
2. Generating all primitive triples and their multiples up to L=1,500,000
3. Counting how many triangles have each perimeter
4. Counting perimeters with exactly one triangle
5. Using conditions: m>n, gcd(m,n)=1, m and n not both odd
