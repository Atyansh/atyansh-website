---
problemNumber: 349
title: "Langton's Ant"
difficulty: 30
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler349.py'
---

## The problem

Langton's ant walks on an initially all-white grid. On a white square it turns clockwise, on a black square it turns counterclockwise, and either way it flips the square's colour and steps forward. Find how many squares are black after 10¹⁸ moves.

## My solution

Project Euler asks that solutions past problem 100 not be published, so this is only a sketch.

There are two files, and they do different jobs.

**`Euler349.py` is a simulator and visualizer.** It runs the ant for a given number of moves (from the command line) on a 101×101 grid and prints how many cells are black. It also draws the grid live in a Swing window of 5-pixel blue and red cells, sleeping 1 ms per move so you can watch the ant. What makes the problem tractable is the ant's known long-run behaviour: after roughly 10,000 chaotic moves it settles into a "highway", a 104-move cycle that repeats forever, moves the ant diagonally, and adds exactly 12 black cells each time. The ant stays well inside the 101×101 grid during the chaotic phase, so the grid is big enough to get there.

**`Euler349.py` computes the answer** in four lines of arithmetic. It takes a starting point after the highway has begun, chosen so that the remaining moves up to 10¹⁸ are an exact multiple of 104. It adds 12 for each remaining cycle to the black-cell count at that starting point, which is what the simulator prints when run for that many moves.

The Java program on its own can't reach 10¹⁸. The move count is an `int`, and the ant would leave the fixed grid once the highway carries it far enough. The Python script is what actually produces the answer.
