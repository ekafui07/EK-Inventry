# Engineering Guardrails & Architectural Policies for EK-Inventry

## 0. Core Engineering Principle: No Shortcuts & Full Dependency Awareness
- **NEVER Take the Shortest Route:** Never apply quick hacks, superficial patches, or isolated band-aids that merely mask a symptom.
- **Trace All Upstream & Downstream Dependencies:** Before proposing, designing, or modifying any line of code, component, data model, API contract, or UI handler, you **MUST** map out:
  1. What other components, endpoints, or DOM elements rely on this code?
  2. What global/local state, caches, or event listeners are affected?
  3. How does this impact RBAC permissions, role policies, and offline vs. online database schemas?
  4. What secondary side-effects or regressions could this introduce?
- **Root-Cause Resolution:** Always identify and resolve the fundamental underlying architecture issue rather than treating the immediate surface error.
- **Explicit Approval Required:** Never execute hasty changes; always align on the full dependency impact before execution.

## UI & Layout Guardrails
When making UI fixes, layout adjustments, or debugging frontend issues in this repository, you **must** adhere to the following rules to prevent regression bugs:

## 1. HTML Structural Integrity
- **Closing Tags:** Be extremely careful when adding or removing `</div>` tags. A single mismatched div inside a `.modal` or `.modal-form` will cause subsequent elements (like `.modal-actions` buttons) to render outside the modal backdrop, completely breaking the layout and form submission.
- **Form Submission:** Always ensure `<button type="submit">` elements are physically nested inside their respective `<form>` tags. If they must exist outside the form structure for layout reasons, explicitly use the `form="form-id"` attribute on the button.

## 2. Accessibility & DOM Validations
- **Labels:** Never use `<label>` tags purely for visual grouping (e.g. "Select Gear", "Assigned Permissions"). Orphaned labels without a `for` attribute or a nested input will fail browser accessibility checks. Instead, use `<div class="fake-label">` which is already styled identically to `.form-group label` in `style.css`.
- **Inputs & IDs:** Every standard form field (`<input>`, `<select>`) must have a unique `id` and `name` attribute. When dynamically generating rows (like in the Checkout gear list), ensure IDs are unique (e.g., `id="checkout-gear-search-0"`).
- **For Attributes:** Ensure every `<label for="...">` strictly matches a single corresponding element's `id`.

## 3. Scoped CSS Modifications
- Do not apply global CSS resets or change flex-direction on primary layout containers (like `.modal-backdrop` or `.view-panel`) to fix a minor visual bug in a single form.
- Use utility classes or target specific components with tight selectors to prevent styles from bleeding into other views.

## 4. Cache Versioning
- This project does not use a bundler (Webpack/Vite). When modifying frontend `.js` or `.css` files, **always bump the cache version query string** (e.g. `?v=42` -> `?v=43`) in `frontend/index.html` to ensure the user's browser immediately loads the new logic.

## 5. Defensive Javascript
- Rely on `hasPermission()` for feature flags and tab visibility. Remember that `Admin` accounts intrinsically pass all `hasPermission` checks.
- When dynamically modifying DOM elements, use optional chaining (`?.`) or explicit null checks (`if (!element) return;`) since many modals are injected or heavily manipulated at runtime.

## 6. Git & Version Control Policy
- **NO Unprompted Git Commits or Pushes:** NEVER execute `git commit`, `git push`, or modify branches/git history without explicit, direct user instruction and permission. All changes should remain local working tree edits unless the user explicitly commands a commit.

