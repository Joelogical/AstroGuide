# Holistic Interpretation Configuration

## Overview

The holistic chart interpretation logic has been refactored to extract all hardcoded values into a centralized configuration file (`holistic_config.js`). This makes it easy to modify interpretation behavior without touching the core logic.

## What Was Hardcoded Before

Previously, the following were hardcoded in `chart_interpreter.js`:

1. **Aspect Grouping Categories** - Which planets belong to which themes (identity/emotions, mind/communication, love/sex, growth/challenges)
2. **Aspect Interpretation Templates** - The text templates for each aspect type (conjunction, opposition, square, trine, sextile)
3. **Holistic Instructions** - The numbered instructions for AI interpretation
4. **Section Headers** - Template section titles and labels
5. **Significance Thresholds** - Score thresholds for HIGH/MEDIUM/LOW significance
6. **Stress Response Templates** - Text templates for stress response descriptions
7. **No-Aspect Fallback Templates** - Templates for when aspects don't exist

## Configuration File Structure

### `holistic_config.js`

#### Planet Theme Groups (`planetThemeGroups`)

Defines which planets belong to which thematic categories:

- `identityEmotions`: Sun, Moon, Ascendant, Chart Ruler
- `mindCommunication`: Mercury
- `loveSex`: Venus, Mars
- `growthChallenges`: Jupiter, Saturn, Outer Planets

**To modify:** Edit the `planets` array in each group, or add new groups.

#### Aspect Interpretation Templates (`aspectInterpretationTemplates`)

Text templates for each aspect polarity:

- `merged` (conjunction)
- `polarized` (opposition)
- `friction` (square)
- `flowing` (trine)
- `cooperative` (sextile)

**Placeholders available:**

- `{planet1Name}`, `{planet2Name}` - Planet names
- `{planet1Sign}`, `{planet2Sign}` - Sign names
- `{planet1Core}`, `{planet2Core}` - Planet core meanings
- `{planet1SignCore}`, `{planet2SignCore}` - Sign core meanings
- `{planet1Keyword}`, `{planet2Keyword}` - Sign keywords

**To modify:** Edit the `template` string in each polarity object.

#### Holistic Instructions (`holisticInstructions`)

Array of instruction strings that guide AI interpretation.

**To modify:** Add, remove, or reorder items in the array.

#### Core Synthesis Config (`coreSynthesisConfig`)

Labels and structure for the core personality synthesis section:

- Section titles
- Foundation labels
- Aspect relationship labels
- Stress response labels

**To modify:** Edit the label strings or add new ones.

#### Template Sections (`templateSections`)

Section headers for different parts of the interpretation template.

**To modify:** Edit the header strings.

#### Significance Thresholds (`significanceThresholds`)

Score thresholds for categorizing planet significance:

- `high`: >= 0.7
- `medium`: >= 0.5
- `low`: < 0.5

**To modify:** Adjust the numeric thresholds.

#### Stress Response Templates (`stressResponseTemplate`, `rulerInfluenceTemplate`)

Templates for describing stress responses.

**Placeholders:**

- `{ascendantSign}`, `{ascendantNegative}`
- `{moonSign}`, `{moonNegative}`
- `{rulerPlanet}`, `{rulerSign}`, `{rulerNegative}`
- `{rulerInfluence}` - Full ruler influence text

**To modify:** Edit the template strings.

#### No Aspect Templates (`noAspectTemplates`)

Templates for when aspects don't exist between key points.

**To modify:** Edit the template strings.

## How to Use

### Modifying Aspect Groupings

To change which planets belong to which theme:

```javascript
// In holistic_config.js
const planetThemeGroups = {
  identityEmotions: {
    planets: ["sun", "moon", "ascendant"], // Add/remove planets here
    description: "Your custom description",
    label: "YOUR CUSTOM LABEL",
  },
  // ... other groups
};
```

### Modifying Aspect Interpretation Text

To change how aspects are described:

```javascript
// In holistic_config.js
const aspectInterpretationTemplates = {
  merged: {
    template: `Your custom text here with {placeholders}...`,
  },
  // ... other templates
};
```

### Adding New Theme Groups

1. Add to `planetThemeGroups`:

```javascript
const planetThemeGroups = {
  // ... existing groups
  spiritualityTransformation: {
    planets: ["neptune", "pluto"],
    description: "Neptune, Pluto aspects",
    label: "SPIRITUALITY & TRANSFORMATION",
  },
};
```

2. Update `groupAspectsByTheme()` in `chart_interpreter.js` to handle the new group.

### Modifying Instructions

To change the holistic interpretation instructions:

```javascript
// In holistic_config.js
const holisticInstructions = [
  "Your first instruction",
  "Your second instruction",
  // ... add more
];
```

## Benefits

1. **Centralized Configuration** - All hardcoded values in one place
2. **Easy Customization** - Modify behavior without touching core logic
3. **Maintainability** - Clear separation of configuration and logic
4. **Flexibility** - Easy to add new themes, templates, or modify existing ones
5. **Template System** - Placeholder-based templates make text generation flexible

## Example: Adding a New Aspect Type

If you want to add support for a new aspect type:

1. Add aspect style to `astrology_rules.js`:

```javascript
const aspectStyles = {
  // ... existing
  quincunx: { polarity: "adjusting", tension: "medium", strength: 0.6 },
};
```

2. Add interpretation template to `holistic_config.js`:

```javascript
const aspectInterpretationTemplates = {
  // ... existing
  adjusting: {
    template: `Your {planet1Name} and {planet2Name} form a quincunx...`,
  },
};
```

3. The system will automatically use the new template when it encounters this aspect polarity.

## Testing

After making changes to the configuration:

1. Test with a sample chart to ensure interpretations generate correctly
2. Verify aspect groupings work as expected
3. Check that template placeholders are replaced correctly
4. Ensure section headers and labels display properly
