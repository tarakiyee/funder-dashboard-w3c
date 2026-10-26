# Funder dashboard for W3C specs

**Live:** https://tarakiyee.github.io/funder-dashboard-w3c/

Public funders are asked to support standards work but have no view of where money or people would help. This dashboard gives them one: enter a W3C spec shortname and get a card of facts about its time in process, editors, horizontal review and maintenance, each paired with what the funder guide draft says about supporting it.

## Why

Public funders are increasingly asked to support open standards work, but a spec gives few cues about where money or people would actually make a difference. This dashboard applies the lens of the Internet-Draft [Evaluating Technical Standards in the Public Interest: A Guide for Public Funding Organizations](https://tarakiyee.github.io/funder-guide-draft/draft-tarakiyee-funder-guide.html) to live data about one spec at a time.

It is an assessment of the funding opportunity around a spec, not of the spec itself. Each card pairs a fact with the question a funder could act on:

- **Time in process.** Maturity and years since first draft. Standards take years; support has to outlast a single grant.
- **Editors.** Who edits the latest version and where they work. More perspectives strengthen a spec; could you fund someone to join?
- **Review.** Which horizontal review requests exist: accessibility, internationalization, privacy, security, TAG. Review needs reviewers; a gap may be something support could fill, or the review may have happened elsewhere.
- **Maintenance.** Recent commits and open issues in the spec repository. Open issues are entry points for funded contributors.

Facts are shown as they are, with no scores or ratings.

## Data

Live, from the browser: the [W3C API](https://api.w3.org/), the [browser-specs](https://github.com/w3c/browser-specs) index (its `web-specs` package on jsDelivr), and the GitHub API. Links out to [webstatus.dev](https://webstatus.dev/) for implementations and to the working group's IPR page for patents.

## Related work

- [W3C spec-dashboard](https://w3c.github.io/spec-dashboard/) tracks publication status, implementations and issue history per working group, for chairs and the W3C team. Same sources, organised for the people running specs rather than for funders.
- [W3C horizontal review tracker](https://w3c.github.io/horizontal-issue-tracker/) lists open review comments for reviewers and editors. The Review section here shows the request side of that process, as a cue for where reviewer time could be funded.
- [OpenSSF Scorecard](https://github.com/ossf/scorecard) scores repositories on security practices. This dashboard deliberately does not score.
- [ecosyste.ms Funds](https://github.com/ecosyste-ms/funds) and [CHAOSS](https://chaoss.community/) bring health metrics and funding allocation to open-source packages. This applies the same intent to standards; the Editors section is CHAOSS's organizational diversity metric applied to one spec.

As far as we know, no existing tool maps a funder's own criteria onto standards documents, or puts who edits a spec and who pays them on one card.

## How it was built

Built in the 90-minute window at the W3C TPAC 2026 hackathon in Dublin, 26 October 2026, for the "Visualize standards data" challenge. The concept, the funder lens, the four fields, the no-scoring stance and every design decision are Tara Tarakiyee's. Two AI tools did the work under that direction, and the commit history is the record of it:

- Before the window: Claude (Anthropic) created the empty repository, verified the W3C API, browser-specs and GitHub endpoints with throwaway requests, and wrote a build brief from the decisions above. No application code was written before 19:30.
- During the window: OpenAI Codex implemented from the brief and pushed each step to `main`. Claude reviewed each push against the brief and the expected data for the demo specs, checked the result in a browser at projector size, and sent corrections and additions as updates.
- Tara decided the demo specs, the layout, the angle wording and what to cut, and relayed between the two tools.

The brief itself is not committed; it is a plan, not code.
