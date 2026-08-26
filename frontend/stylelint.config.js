/**
 * Rules chosen against what has actually gone wrong in this stylesheet, not
 * against a house style.
 *
 * The linter earned its place immediately: a @media block in layout.css was
 * missing its closing brace and had swallowed seventeen rules meant for every
 * screen, so they only applied below 520px. Nothing else noticed — the file
 * still parsed, it just meant something different.
 */
export default {
  extends: 'stylelint-config-standard',
  rules: {
    // Naming here is BEM-ish with double underscores and camelCase tails
    // (.auth__markRow, .rail__sectionLabel). The default patterns reject that,
    // and renaming ~200 classes to satisfy a linter buys nothing.
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'keyframes-name-pattern': null,

    // Checked all seven it reported. Every one is a component's :disabled rule
    // written after its :hover:not(:disabled) rule — states that cannot both
    // match — or two rules that share no property at all. It flags source
    // order rather than real collisions, so here it is only noise.
    'no-descending-specificity': null,

    // `transition: color 140ms ease, border-color 140ms ease` is clearer than
    // the longhand this would demand.
    'declaration-block-no-redundant-longhand-properties': null,

    // rgb(0 0 0 / 50%) is already the modern form; these rules want percentages
    // and notations that would churn the palette for no gain.
    'alpha-value-notation': null,
    'color-function-notation': null,

    /*
     * The tokens exist; this is what keeps them used. Spacing and type drifted
     * to 26 distinct spacing values and 14 font sizes precisely because
     * nothing stopped a literal being typed, and half-pixel neighbours like
     * 12 / 12.5 / 13 are invisible on screen but leave the next person
     * guessing which to copy.
     *
     * Negative values are allowed through: they pull an element off the flow
     * to correct an optical detail and are not part of the spacing rhythm.
     * Widths, heights and offsets are not covered — those are component
     * dimensions, not rhythm.
     */
    'declaration-property-value-disallowed-list': {
      '/^(gap|column-gap|row-gap|padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/':
        ['/(^|[^-\\d])\\d+px/'],
      'font-size': ['/^[0-9]/'],
      'transition-duration': ['/^[0-9]/'],
      'animation-duration': ['/^[0-9]/'],
    },
  },
};
