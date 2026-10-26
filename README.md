# Funder dashboard for W3C specs

Enter a W3C spec shortname and get a card showing where funding could help that spec.

## Why

Public funders are increasingly asked to support open standards work, but a spec gives few cues about where money or people would actually make a difference. This dashboard applies the lens of the Internet-Draft [Evaluating Technical Standards in the Public Interest: A Guide for Public Funding Organizations](https://tarakiyee.github.io/funder-guide-draft/draft-tarakiyee-funder-guide.html) to live data about one spec at a time.

It is an assessment of the funding opportunity around a spec, not of the spec itself. Each card pairs a fact with the question a funder could act on:

- **Time in process.** Maturity and years since first draft. Standards take years; support has to outlast a single grant.
- **Editors.** Who edits the latest version and where they work. More perspectives strengthen a spec; could you fund someone to join?
- **Review.** Which horizontal review requests exist: accessibility, internationalization, privacy, security, TAG. Review needs reviewers; a gap may be something support could fill, or the review may have happened elsewhere.
- **Maintenance.** Recent commits and open issues in the spec repository. Open issues are entry points for funded contributors.

Facts are shown as they are, with no scores or ratings.

## Data

Live, from the browser: the [W3C API](https://api.w3.org/), the [browser-specs](https://github.com/w3c/browser-specs) index, and the GitHub API. Links out to [webstatus.dev](https://webstatus.dev/) for implementations and to the working group's IPR page for patents.

## Related work

- [W3C spec-dashboard](https://w3c.github.io/spec-dashboard/) tracks publication status, implementations and issue history per working group, for chairs and the W3C team. Same sources, organised for the people running specs rather than for funders.
- [W3C horizontal review tracker](https://w3c.github.io/horizontal-issue-tracker/) lists open review comments for reviewers and editors. The Review section here shows the request side of that process, as a cue for where reviewer time could be funded.
- [OpenSSF Scorecard](https://github.com/ossf/scorecard) scores repositories on security practices. This dashboard deliberately does not score.
- [ecosyste.ms Funds](https://github.com/ecosyste-ms/funds) and [CHAOSS](https://chaoss.community/) bring health metrics and funding allocation to open-source packages. This applies the same intent to standards.

Built at the W3C TPAC 2026 hackathon in Dublin.
