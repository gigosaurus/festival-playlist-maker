# Instructions for AI assistants

Read [STANDARDS.md](STANDARDS.md) before you change this project. All of its rules apply to your work:

- Write all text in Standard Technical English (section 1). This includes interface text, error messages, documentation, code comments, commit messages and pull request descriptions.
- Use the terms in the glossary ([GLOSSARY.md](GLOSSARY.md)). Do not use synonyms for them.
- Before you design or change a page, use the design brief (section 4.1). The criteria are quality checks, not the design brief.
- Make sure that each change conforms to the website acceptance criteria with the project interpretation (section 2), to CP-01 to CP-07 (section 3) and to ED-01 to ED-07 (section 4).
- When you change a page, a type style, a colour role, a component role or an animation, update [docs/design-spec.md](docs/design-spec.md).
- Before you tell the user that a change is complete, run the tests. Then look at the rendered pages. A source-code review alone is not sufficient (PB-06).
- If a change makes an audit result in [docs/audit/](docs/audit/) incorrect, update the result and its evidence.

## Agent skills

### Issue tracker

Issues are in GitHub Issues for gigosaurus/festival-playlist-maker. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The project uses the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

The project has a single context: one `GLOSSARY.md` and one `docs/adr/` at the repository root. See `docs/agents/domain.md`.
