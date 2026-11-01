---
title: 'Project Euler Solutions'
description: 'My solutions to 87 Project Euler problems from college, mostly in Java, with a write-up of how each one works.'
technologies: ['Java', 'Python']
featured: true
startDate: 2014-01-30
endDate: 2016-11-12
links:
  github: 'https://github.com/atyansh/Project-Euler'
  website: 'https://projecteuler.net'
---

[Project Euler](https://projecteuler.net) is a long list of math problems that are meant to be solved with a program: each one has a single numeric answer, and a good solution should run in under a minute. I worked through them in college, between 2014 and 2016, and solved 87.

**[Browse all 87 write-ups →](/euler)**

72 of the solutions are in Java. 14 are in Python, mostly where arbitrary-precision integers saved effort (Python 2 back then). One, [problem 15](/euler/15), has no code at all: it's a counting argument in a text file.

## Some favourites

- **[96: Su Doku](/euler/96)** turns Sudoku into a Boolean satisfiability problem (729 variables, with "exactly one" clauses for every cell, row, column and box) and hands all 50 puzzles to a SAT solver, so there's no search code at all.
- **[349: Langton's Ant](/euler/349)** asks where an ant is after 10¹⁸ moves. The trick is that the ant eventually settles into a repeating "highway", so the rest can be computed instead of simulated. I also wrote a little Java Swing visualiser to watch it happen.
- **[69: Totient Maximum](/euler/69)** turned out to be easier with pen and paper than with code. n/φ(n) only depends on which primes divide n, which points straight at the answer.
- **[1](/euler/1)** is a single inclusion–exclusion expression, with no loop.
- **[17](/euler/17)** counts the letters in the numbers one to one thousand written out in words, without ever writing a number out: it tallies how often each of 30 words appears.
- **[81](/euler/81), [82](/euler/82) and [83](/euler/83)** are three minimum-path-sum grids that get harder as more directions are allowed. All three are solved with the same queue-based shortest-path search.

Project Euler asks people not to publish solutions past the first hundred problems, so [187](/euler/187), [206](/euler/206) and [349](/euler/349) are described only in outline, and none of the write-ups give away an answer.
