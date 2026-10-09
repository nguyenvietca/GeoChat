# AGENTS

This repository follows the architecture described in readme_structure.md.

## Principles

- Keep the monorepo structure stable.
- Prefer simple, beginner-friendly code.
- Use Java 21 + Spring Boot for the backend and React + Vite for web.
- Keep shared packages intentionally small.

### Development Scope and Constraints

- **Web:** Prioritize UI/UX, responsive design, feature implementation, accessibility, and overall user experience.
- **Backend:** Modify only when necessary to support Web requirements. Reuse existing APIs where possible and maintain compatibility with the existing Mobile client whenever reasonable.
- **Mobile:** Do not implement new Mobile UI or features. Do not require Mobile builds, typechecks, or tests in this prompt.
- **Architecture:** Preserve all existing Mobile code. Avoid unnecessary breaking API changes, database changes, or modifications to shared contracts.
- **Testing:** Focus on Web and Backend testing, including regression testing for existing functionality affected by the changes.
- **Scope Control:** Do not expand the task into unrelated refactoring or Mobile development. Keep changes focused on the objectives of the current prompt.

## Validation

- Do not require or run tests on a physical device. Use automated tests or an emulator/simulator when available, and report physical-device checks as skipped because no real device is available.
