# Unified Bottom Sheet System

## Overview
A cohesive, reusable bottom sheet system that powers the Amount Calculator and Account Selector, providing a consistent interaction pattern across the Money Manager app.

## Architecture

### Core Components

#### 1. **AppBottomSheet** (`components/ui/AppBottomSheet.tsx`)
The foundational bottom sheet component using `@gorhom/bottom-sheet`.

**Features:**
- Smooth spring animations with drag-to-dismiss
- Backdrop blur effect (adaptive to light/dark theme)
- Dark header bar with title and actions
- Flexible snap points (default: 45%-75%)
- Accessible close button (X icon)

**Props:**
```tsx
interface AppBottomSheetProps {
  visible: boolean;
  title: string;
  snapPoints?: Array<string | number>;
  initialSnapIndex?: number;
  actions?: AppBottomSheetAction[];
  footer?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}
```

**Styling:**
- Border radius: 20px (top corners)
- Header background: Dark (#0B1120 dark, #0F172A light)
- Divider: Subtle border below header
- Backdrop: Blur with adaptive intensity

---

#### 2. **AmountCalculatorSheet** (`components/AmountCalculatorSheet.tsx`)
Quick amount entry with numeric keypad and live expression evaluation.

**Features:**
- 4x4 numeric keypad with operators (+, -, ×, ÷)
- Real-time expression evaluation
- Delete (⌫) and clear (C) operations
- Currency selector in actions
- Snap point: 60% of screen
- Haptic feedback on every key press
- Large, tappable buttons (64px height, 14px radius)

**Key Layout:**
```
1 2 3 ⌫
4 5 6 -
7 8 9 +
0 . Done
```

**Usage:**
```tsx
<AmountCalculatorSheet
  visible={activeSheet === 'calculator'}
  value={amount}
  onChange={setAmount}
  onClose={() => closeSheet()}
  onConfirm={(nextValue) => {
    setAmount(nextValue);
    closeSheet();
  }}
  onCurrencyPress={() => handleCurrencyAction()}
/>
```

---

#### 3. **AccountSelectorSheet** (`components/AccountSelectorSheet.tsx`)
Grid-based account selection with visual feedback.

**Features:**
- 2-column responsive grid
- Account icons with colored backgrounds
- Border highlight for selected account
- Edit (✏️) and expand (⛶) action buttons
- Snap point: 75% of screen
- Haptic feedback on selection
- Enhanced shadow and scale animations

**Card Styling:**
- Border radius: 16px
- Minimum height: 114px
- Icon size: 44x44px (centered)
- Selected state: Primary color border (2.5px width)
- Pressed state: 97% scale with reduced opacity

**Usage:**
```tsx
<AccountSelectorSheet
  visible={activeSheet === 'accounts'}
  title="Accounts"
  accounts={accounts}
  selectedAccountId={selectedId}
  onSelect={(account) => {
    setSelectedAccount(account.id);
    closeSheet();
  }}
  onClose={() => closeSheet()}
  onEdit={() => handleEdit()}
  onExpand={() => handleExpand()}
/>
```

---

#### 4. **CalculatorModal** (`components/planning/CalculatorModal.tsx`)
Financial calculators (mortgage, loan, investment) using the bottom sheet system.

**Features:**
- Large snap point: 85% for complex input forms
- Multiple input fields with labeled icons
- Calculate button with haptic feedback
- Result display with dividers
- Save to notes functionality

**Financial Calculators:**
- Loan calculator
- Mortgage calculator
- Investment calculator
- Other financial tools

**Usage:**
```tsx
<CalculatorModal
  activeCalculator={activeCalculator}
  calculatorForm={form}
  calculatorResult={result}
  onClose={() => closeCalculator()}
  onFieldChange={(field, value) => updateField(field, value)}
  onCalculate={() => performCalculation()}
/>
```

---

### State Management

#### **useBottomSheetController** Hook (`hooks/useBottomSheetController.ts`)
Generic hook for managing bottom sheet visibility states.

```tsx
const { activeSheet, openSheet, closeSheet, isOpen } = useBottomSheetController<
  'calculator' | 'accounts' | 'category'
>();

// Open a sheet
openSheet('calculator');

// Close all sheets
closeSheet();

// Check if specific sheet is open
if (isOpen('calculator')) { ... }
```

---

## Visual Design

### Color Scheme
- **Header:** Dark background (#0B1120 / #0F172A)
- **Header Text:** Light (#F8FAFC)
- **Actions:** Subtle light background with 8% opacity
- **Cards:** Theme-colored surfaces with subtle borders
- **Pressed State:** 96-97% scale with 80-92% opacity

### Typography
- **Headers:** 16-18px, bold (700 weight)
- **Labels:** 15-16px, semi-bold (600 weight)
- **Input text:** 16px, regular
- **Buttons:** 16-18px, bold (700 weight)

### Spacing
- **Content padding:** 20px horizontal, 16px vertical
- **Gap between items:** 14px
- **Button height:** 64px (calculator), 110px+ (tiles)
- **Border radius:** 14-20px (components), 20px (sheet)

---

## Animations & Interactions

### Bottom Sheet
- **Spring animation:** Smooth, physics-based
- **Drag-to-dismiss:** Enabled by default
- **Backdrop:** Blur + dim (interactive, closes on tap)

### Buttons
- **Press feedback:** Scale 0.96-0.97 + opacity fade
- **Haptic:** Light impact on every interaction
  - Number pad key press
  - Account selection
  - Done/Calculate button

### Transitions
- **Entry:** Spring snap from bottom
- **Exit:** Spring snap downward with blur fade
- **Indicator:** Subtle rounded bar at top

---

## Integration Guide

### In AddTransactionModal
```tsx
const { activeSheet, openSheet, closeSheet } = useBottomSheetController<
  'calculator' | 'accounts' | 'category'
>();

// Open amount calculator
const openCalculatorSheet = () => {
  Keyboard.dismiss();
  setCalculatorDraft(amount);
  openSheet('calculator');
};

// Render sheets
<AmountCalculatorSheet
  visible={activeSheet === 'calculator'}
  value={calculatorDraft || amount}
  onChange={setCalculatorDraft}
  onClose={() => closeSheet()}
  onConfirm={(nextValue) => {
    setAmount(nextValue);
    closeSheet();
  }}
/>
```

### In PlanningScreen
```tsx
const [activeCalculator, setActiveCalculator] = useState<CalculatorKey | null>(null);
const { ... } = useFinancialCalculators({...});

<CalculatorModal
  activeCalculator={activeCalculator}
  calculatorForm={calculatorForm}
  calculatorResult={result}
  onClose={() => setActiveCalculator(null)}
  onFieldChange={handleFieldChange}
  onCalculate={handleCalculate}
/>
```

---

## Features & Benefits

✅ **Consistent Experience**
- Same interaction pattern across amount & account selection
- Unified header, animations, and gestures

✅ **Performance**
- Reusable component reduces bundle size
- Efficient state management with generic hook

✅ **Accessibility**
- Clear labels and icons
- Haptic feedback for all interactions
- Proper accessibility labels for screen readers

✅ **Polish**
- Smooth animations (spring physics)
- Subtle shadows and depth
- Adaptive dark/light themes
- Modern button interactions

✅ **Flexibility**
- Generic AppBottomSheet works with any content
- Custom snap points per use case
- Optional actions and footer

---

## Configuration Reference

### Snap Points by Use Case
| Component | Snap Points | Purpose |
|-----------|-------------|---------|
| Amount Calculator | 60% | Quick entry, minimal content |
| Account Selector | 75% | Grid layout, more vertical space |
| Financial Calculators | 85% | Multiple inputs, results display |

### Button Styling
```tsx
// Enhanced button dimensions:
- Height: 64px (calculator keypad)
- Border radius: 14px
- Press scale: 0.96
- Press opacity: 0.80
- Text: 20px, bold
```

---

## Best Practices

1. **Always use `useBottomSheetController`** for state management
2. **Provide haptic feedback** for critical interactions
3. **Set appropriate snap points** based on content
4. **Test accessibility** with screen readers
5. **Use theme colors** consistently (primary for actions, text for labels)
6. **Keep header actions minimal** (2-3 buttons max)

---

## Dependencies
- `@gorhom/bottom-sheet` - Core sheet functionality
- `expo-blur` - Backdrop blur effect
- `expo-haptics` - Tactile feedback
- `lucide-react-native` - Icons
- Theme store for color consistency

---

## File Structure
```
components/
├── ui/
│   └── AppBottomSheet.tsx (foundation)
├── AmountCalculatorSheet.tsx (amount entry)
├── AccountSelectorSheet.tsx (account grid)
├── AddTransactionModal.tsx (uses sheets)
└── planning/
    ├── CalculatorModal.tsx (financial calcs)
    └── CalculatorModal.tsx (uses sheets)

hooks/
└── useBottomSheetController.ts (state)
```

---

**Last Updated:** March 17, 2026
**Status:** Production Ready ✅
