# UI & Layout Guardrails for EK-Inventry

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

