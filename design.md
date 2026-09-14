# BrightEd interface design

The frontend-design and ui-ux-pro-max skills guide this shared presentation system.

## Direction
Warm enterprise workbench: charcoal navigation, ivory canvas, white surfaces, restrained BrightEd orange and muted green for learning/access data. The executive overview is the visual entry point; operational tables and forms retain their existing actions and information architecture.

## Typography and components
Manrope for headings and metrics, DM Sans for body and controls, Instrument Serif italic for the overview and sign-in headline accent. Fonts have local system fallbacks and use display=swap. Semantic design tokens live in tokens.css. The additive public/enterprise.css layer styles the existing components without replacing the original stylesheet.

Cards use a consistent 16px radius and two levels of quiet elevation. Inputs and buttons retain visible labels, focus rings, disabled states and native keyboard behavior. Navigation uses inline stroke SVGs with named buttons. Reduced-motion preferences suppress motion.

## Data visualization
Overview charts are derived from already loaded responses: enrollment dates grouped by local calendar month for the last six months, active student account share, SkillHubs ranked by enrollment, and assessment results. No synthetic metrics or growth claims. Active account access is explicitly distinguished from material completion. Empty datasets display zero or an em dash as appropriate. Chart values and accessible summaries accompany color.

## Responsive behavior
Desktop uses a persistent navigation rail. Tablet and mobile reflow the rail into a compact navigation grid controlled by the existing menu button. Cards stack by priority. Wide operational tables scroll within their own containers. All roles share the same tokens and component styling.

## Boundaries
No backend files, request paths, HTTP options, auth helpers, business rules or existing action binding attributes were changed. The added overview uses the existing reports visibility permission. Existing modules and role workflows remain available.

## Verification
- JavaScript syntax check and TypeScript lint.
- Browser navigation through every admin tab at 1440, 768, 414, 375 and 320px.
- Student, facilitator and supervisor views at desktop, 375 and 320px.
- No page overflow or browser JavaScript errors in those checks.
- Student search empty state and reset, add-form opening, collapsed navigation, CSV template download.
- Simulated API failure, retry recovery, delayed loading state and empty overview.
- Visual review of desktop overview, login, student table and mobile overview.

Destructive and record-changing workflows were not executed during UI verification.

## Interface languages
The Dashboard menu is named Dashboard in both languages. public/i18n.js holds the formal British English UI dictionary and presentation-only template helpers; Indonesian remains the default. A language selector is available on sign-in and in every role's header. The browser stores brighted_language; changing it reloads the page while preserving the authentication token. Save unfinished form work before switching.

Only authored interface copy and displayed date/number formats are localised. Interpolated user and learning content remains unchanged. Form values, API enums, imports, certificate template content, and request expressions retain their original values. The locale-aware template helpers translate text, tooltips, placeholders, and accessible labels, never data attributes or field values.

Verification covered both language directions, authentication persistence, all four roles, admin navigation from 320px to 1440px, empty search results, unchanged user content, raw status option values, and unchanged API/import helpers.
