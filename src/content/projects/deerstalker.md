---
title: "Deerstalker"
description: "Four-player online brawler in C++ for UCSD CSE 125: hats grant abilities, physics runs on an authoritative Bullet server, clients render protobuf snapshots."
technologies: ["C++", "OpenGL", "Bullet Physics", "Protocol Buffers", "Boost Asio", "FMOD", "ASSIMP", "FreeType"]
featured: true
startDate: 2016-03-28
endDate: 2016-06-03
links:
  github: "https://github.com/atyansh/deerstalker"
---

A four-player online brawler built by a team of seven in UCSD's ten-week CSE 125 course. Players fight on a construction-site stage with three lives each, knocking each other off the edge. Hats drop onto the stage every ten seconds or so, and each of the five gives its wearer a primary and a secondary ability, from mango-shooting and healing to switching off gravity for everyone.

I wrote the server and networking. The server runs a 30 Hz loop that owns the only Bullet physics world: clients send input events over TCP as protobuf messages, and every tick the server sends back a full snapshot of each player, hat and projectile (world matrix, health, lives, hat, animation state). I also wrote the character controller, the combat and hat logic, the client's input and message handling, and the FMOD sound engine. My teammates built the rendering, animation, UI and art.
