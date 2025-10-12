---
title: 'Saber: Delegating Web Security to Browser'
description: 'A prototype Fetch API that delegates web requests to Google Chrome, providing secure TLS connections without requiring security expertise.'
authors: ['Atyansh Jaiswal']
pubDate: 2017-06-01
featured: true
tags: ['web security', 'TLS', 'browser security', 'Fetch API']
links:
  pdf: 'https://atyansh.com/saber.pdf'
---

# Abstract

This paper presents Saber, a system that delegates web security responsibilities to the browser. By creating a prototype Fetch API that routes requests through Google Chrome, applications can benefit from secure TLS connections without requiring developers to have security expertise.

## Key Features

- **Secure TLS Connections**: Leverages Chrome's battle-tested TLS implementation
- **Zero Security Expertise Required**: Applications automatically inherit browser security features
- **Strict Transport Security**: Provides HSTS enforcement for free
- **Public-Key Pinning**: Built-in support for certificate pinning
- **Revocation Checking**: Automatic certificate revocation validation

## Research Context

This work was conducted as part of my graduate research at UC San Diego, focusing on addressing security issues in non-browser web-connected applications. The fundamental insight is that browsers have spent decades perfecting web security mechanisms, and applications can benefit from this work by delegating security decisions to the browser.

For the full paper, please see the [PDF link](https://atyansh.com/saber.pdf).
