---
title: 'Project Euler Solutions'
description: 'My solutions to 87 Project Euler problems (2014–2016), mostly Java, with write-ups from rereading every one of them years later.'
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

## Rereading them

The write-ups are from going back through every file in 2026 and describing what the code actually does, not what I'd do today. Most of it is the straightforward approach: trial division where a sieve would be faster, nested loops with hand-picked bounds, and a fresh set for every starting number where a memo would do. Some of it is better than I remembered, and a few of the bugs are worth pointing out:

- **[96: Su Doku](/euler/96)** encodes Sudoku as Boolean satisfiability (729 variables, "exactly one" clauses for every cell, row, column and box) and hands all 50 puzzles to a SAT solver instead of writing a backtracking search.
- **[1](/euler/1)** has no loop: it's a single inclusion–exclusion expression with the counts worked out by hand.
- **[17](/euler/17)** never converts a number to words. It multiplies a hand-counted table of how often each of 30 words appears from 1 to 1000.
- **[81](/euler/81), [82](/euler/82) and [83](/euler/83)**, the three path-sum grids, all use the same queue-based shortest-path relaxation rather than dynamic programming or Dijkstra.
- **[349: Langton's Ant](/euler/349)** relies on the ant eventually settling into a repeating "highway", so 10¹⁸ moves never have to be simulated. There's also a Java Swing visualiser I wrote to watch it.
- **[69](/euler/69)** is an abandoned brute force with a comment at the bottom saying I gave up and worked the answer out by hand.
- **[51](/euler/51)** prints the wrong number. It never checks that the replaced digits were equal to begin with, so the prime it stops on isn't in its own family. The real answer is in the debugging output it prints alongside.
- **[8](/euler/8)** multiplies five adjacent digits, because that's what the problem asked when I solved it. It has since been changed to thirteen.

Project Euler asks people not to publish solutions past the first hundred problems, so [187](/euler/187), [206](/euler/206) and [349](/euler/349) are described only in outline, and no write-up gives a final answer.
