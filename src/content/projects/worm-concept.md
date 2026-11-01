---
title: 'Worm Concept'
description: "An unfinished Ren'Py fan visual novel set in Wildbow's Worm: one scene, one choice and three endings, built as a proof of concept in 2020."
technologies: ["Ren'Py", 'Python']
featured: false
startDate: 2020-03-01
endDate: 2020-04-09
links:
  github: 'https://github.com/atyansh/worm_concept'
---

A prototype for a fan visual novel set in the world of *Worm*, Wildbow's web serial about "capes" (people with superpowers). It isn't an adaptation of the serial: the story is new, written around three of its main characters, Taylor, Lisa and Alec, and leans on the setting's vocabulary (triggers, Parahumans Online, Winslow High, Fugly Bob's). The README frames it as a group effort, with a Discord invite for people who wanted to help.

## What exists

The first commit (March 2020) was one cafeteria scene: Lisa narrating her first day at Winslow High, and Taylor greeting her. "Version 2" (April 2020) threw that out and replaced it with about 80 lines of script told from the point of view of an original protagonist who has powers and is hiding them. They're half-listening in a lecture on cape theory when Lisa, who has been scouting the school for capes, says she's noticed them. The player gets one choice:

```python
menu:
    "Tell her you're just a cape nerd":
        jump nerd
    "Admit you're a cape":
        jump cape
    "Flirt with her":
        jump flirt
```

Each branch ends on its own end-card. Bluffing gets a neutral ending. Flirting gets Taylor's insects set on you (the bad ending). Admitting it moves the scene to a shopping area to meet Alec and Taylor and ends with everyone heading to dinner (the good ending).

## How it's built

It's standard Ren'Py: `definitions.rpy` declares the characters and sprite images (four Taylor expressions, three Alec, one Lisa, all scaled with `zoom 0.6`), `script.rpy` holds the story, and `myscreens.rpy` adds custom screens for the three end-cards and a looping WebM of Taylor dancing that plays over the scene for one line. There's background music and a school-bell sound effect.

## State

It's a short demo that stopped after Version 2; there are no commits after April 2020. The README says some assets were "borrowed" as placeholders until original art was made; it never got that far. Four of the six backgrounds are defined but never used, and the `taylor 2` sprite accidentally points at the same image as `taylor 1`.
