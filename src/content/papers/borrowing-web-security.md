---
title: 'Saber: Delegating Web Security to Browser'
description: 'Measures how wget, curl, Python and Node handle bad TLS certificates, then builds swget, a wget that hands every request to Chrome.'
authors: ['Atyansh Jaiswal', 'Jonathan Luck', 'Joshua Chao']
pubDate: 2017-06-01
featured: true
tags: ['TLS', 'HTTPS', 'certificate validation', 'HSTS', 'browser security']
links:
  pdf: '/papers/saber.pdf'
---

## The problem

Browsers do far more than "speak TLS". On top of certificate validation they enforce HSTS (always use HTTPS for a domain that asked for it), HTTP public key pinning (HPKP), revocation checks (CRLs, OCSP stapling, Must-Staple, and browser-pushed revocation lists), Safe Browsing malware checks, and they show the user what happened. Command-line HTTP clients and request libraries usually do only the first part, and earlier work had shown that they often get even that wrong because TLS library options are easy to misconfigure.

The paper argues that small tools should not reimplement any of this. Instead, they should hand the network request to a browser and keep only the application logic.

## Measuring today's clients

We tested six clients (wget, curl, Python's and Node.js's standard request libraries, Firefox and Chrome) against a set of deliberately bad or borderline HTTPS endpoints. The full results are in the appendix table. The main findings:

- **Revoked certificates:** wget, curl, Python and Node all accepted them. Only the two browsers rejected them.
- **Pinning:** a site with a mismatched HPKP pin was rejected only by the browsers. Of the four non-browser clients, only wget supported HSTS at all, and its pinning support was limited and manual.
- **Weak crypto:** all four non-browser clients accepted a SHA-1-signed intermediate. wget also accepted RC4 and RC4-MD5. Every client except Chrome accepted 1024-bit, small-subgroup and composite Diffie-Hellman parameters, and only Chrome enforced the Signed Certificate Timestamp check.
- **Basics were fine:** every client rejected expired, wrong-host, self-signed and untrusted-root certificates, plus the known-bad Superfish, eDellRoot and DSD Test Provider roots.

Two other issues came out of this:

- **A wget HSTS bug.** wget did not refresh an HSTS entry's expiry when it saw a new header from the same site, so a site with a one-day `max-age` would leave wget unprotected at least once a day no matter how often it was visited. We reported it and it was fixed upstream.
- **Silent downgrades.** wget and curl follow an HTTPS-to-HTTP redirect without saying so. That is acceptable in a browser, where the address bar shows the downgrade, but not when someone pipes `wget` output into `bash`: a network attacker could then run code on their machine.

## Design: let Chrome make the request

The prototype drives Chrome through its **remote debugging protocol**, which lets another process talk to the browser over a WebSocket. The client asks Chrome to fetch a URL and reads back the response. Because Chrome makes the connection, every check it normally applies (certificate validation, HSTS, HPKP, revocation, Safe Browsing) applies to the request automatically. The client adds only the policy decisions that make sense for its own use case, such as how to handle redirects.

The paper also sketches a leaner design that links Chrome's networking library directly behind a small request API, without running a browser and exchanging serialized messages over a socket. It leaves that for future work.

## swget

swget ("secure wget") is the proof of concept: a wget-like downloader built on the Chrome remote interface Node.js library. According to the paper, wget has 994 lines of code for interfacing with OpenSSL, while swget needs none. Handling certificate errors takes 8 lines: swget overrides Chrome's certificate handling through the debugging protocol, catches the error Chrome reports, and cancels the request. Beyond what Chrome provides by default, swget:

- **Refuses HTTPS-to-HTTP redirects** unless the user explicitly allows them (the screenshots show an `--allow-insecure-redirects` flag).
- **Prints clearer warnings**, including lock indicators and Safe Browsing "this page is dangerous" errors for malware and phishing test pages.
- **Can use the browser's session.** It can run with the user's Chrome profile, so it can download pages that need the user's cookies, or with a fresh profile that shares nothing. It also prompts for HTTP Basic Auth credentials, which Chrome then remembers for the session.
- **Shares HSTS and HPKP state with the browser.** Normally a pin or HSTS entry learned by Chrome does nothing for wget, and the reverse is also true. If every tool goes through one browser, they all share one record of these protections.

## How it was evaluated

The evaluation is the client comparison above plus demonstrations of swget: normal downloads, rejected expired, wrong-host and unpinned certificates, a blocked insecure redirect, Safe Browsing blocks, and Basic Auth. There are no performance measurements and no user study.

## Limitations the paper states

- The remote debugging approach is inefficient because each request and response is serialized over a WebSocket. Linking Chrome's network stack directly is proposed but not built.
- swget does not yet handle mixed content, CSP `upgrade-insecure-requests`, or subresource integrity. The paper lists these as planned work.
- Whether the new command-line warnings actually change user behavior was not measured.

The paper contrasts its approach with earlier work that retrofits certificate validation into existing applications by intercepting SSL libraries through dynamic linking. That approach needs no changes to applications, but it only fixes certificate validation. Delegating to the browser also brings HSTS, revocation lists, malware blocking, and protections shared across clients.
