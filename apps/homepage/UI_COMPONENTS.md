# 🎨 Lexara UI Components & Design Patterns

## 🎭 Design System Foundation

### **Color Palette**

```css
/* Primary Colors */
--lexara-primary: #2563eb /* Blue - Primary actions, links, brand */
  --lexara-secondary: #1f2937 /* Dark gray - Text, headings */
  /* Neutral Colors */ --lexara-gray: #6b7280 /* Medium gray - Secondary text */
  --lexara-light: #f3f4f6 /* Light gray - Backgrounds, borders */
  /* Accent Colors */ --lexara-accent: #10b981
  /* Green - Success, positive actions */ --lexara-error: #ef4444
  /* Red - Errors, destructive actions */ --lexara-success: #10b981
  /* Green - Success states */ /* Extended Palette */ --lexara-darkNavy: #1e293b
  /* Dark navy - Rich text */ --lexara-lightNavy: #475569
  /* Light navy - Secondary elements */;
```

### **Typography Scale**

```css
/* Font Families */
font-family-heading: 'Lora', serif;     /* Professional, trustworthy */
font-family-body: 'Open Sans', sans-serif;  /* Readable, clean */

/* Size Scale (Tailwind) */
text-xs: 0.75rem     /* Small labels, captions */
text-sm: 0.875rem    /* Form labels, secondary text */
text-base: 1rem      /* Body text, default */
text-lg: 1.125rem    /* Subheadings */
text-xl: 1.25rem     /* Section headings */
text-2xl: 1.5rem     /* Page titles */
text-3xl: 1.875rem   /* Main headings */
```

### **Spacing System (Tailwind)**

```css
/* Common spacing values */
spacing-1: 0.25rem   /* 4px - Tight spacing */
spacing-2: 0.5rem    /* 8px - Small gaps */
spacing-3: 0.75rem   /* 12px - Medium gaps */
spacing-4: 1rem      /* 16px - Standard spacing */
spacing-6: 1.5rem    /* 24px - Section spacing */
spacing-8: 2rem      /* 32px - Large spacing */
spacing-12: 3rem     /* 48px - Section dividers */
```

## 🧱 Component Library

### **1. Buttons**

**Primary Button Pattern:**

```css
Classes: bg-lexara-primary text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors

States:
- Default: Blue background, white text
- Hover: Darker blue background
- Disabled: Gray background, reduced opacity
- Loading: Spinner icon with "Processing..." text
```

**Secondary Button Pattern:**

```css
Classes: text-lexara-gray border border-gray-300 rounded-lg hover:bg-gray-50 px-4 py-2

States:
- Default: White background, gray border and text
- Hover: Light gray background
- Disabled: Lighter gray text and border
```

**Destructive Button Pattern:**

```css
Classes: text-lexara-error hover:text-red-700 text-sm

Usage: Delete, remove, destructive actions
States: Default red text, darker red on hover
```

### **2. Form Components**

**Input Field Pattern:**

```css
Classes: w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lexara-primary focus:border-transparent

States:
- Default: Gray border, white background
- Focus: Blue ring, transparent border
- Error: Red border, red ring
- Disabled: Gray background, gray text
- Readonly: Light gray background
```

**Label Pattern:**

```css
Classes: block text-sm font-medium text-lexara-secondary mb-2

Usage: Consistent labeling for all form inputs
Required fields: Include asterisk (*) in label text
```

**Select Dropdown Pattern:**

```css
Classes: w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lexara-primary focus:border-transparent

Options: Styled consistently with input fields
```

**Form Layout Pattern:**

```css
Container: space-y-4 (16px gap between form groups)
Grid layouts: grid grid-cols-1 md:grid-cols-2 gap-4
```

### **3. Modal Components**

**Modal Overlay Pattern:**

```css
Classes: fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50

Purpose: Dark backdrop for modal focus
Behavior: Click outside to close (implemented via JavaScript)
```

**Modal Container Pattern:**

```css
Classes: flex items-center justify-center min-h-screen px-4
Content: relative bg-white rounded-lg max-w-md w-full mx-auto shadow-xl

Responsive: Full width on mobile, fixed width on desktop
```

**Modal Header Pattern:**

```css
Classes: flex items-center justify-between mb-4
Title: text-lg font-semibold text-lexara-secondary
Close button: text-lexara-gray hover:text-lexara-secondary with X icon
```

**Modal Footer Pattern:**

```css
Classes: flex justify-end space-x-3 mt-6
Buttons: Cancel (secondary) + Primary action button
```

### **4. Navigation Components**

**Header Navigation Pattern:**

```css
Container: bg-white shadow-sm border-b border-gray-200
Layout: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
```

**Logo/Brand Pattern:**

```css
Logo: w-8 h-8 bg-lexara-primary rounded-lg (with "L" icon)
Text: text-lg font-semibold text-lexara-secondary
Layout: flex items-center with spacing
```

**Navigation Links Pattern:**

```css
Default: text-lexara-lightNavy hover:text-lexara-darkNavy transition-colors font-semibold
Active: text-lexara-darkNavy font-semibold border-b-2 border-lexara-primary
```

**User Menu Pattern:**

```css
Avatar: w-8 h-8 bg-lexara-primary rounded-full (with initials)
Info: User name and email in right-aligned text
Logout: text-lexara-lightNavy hover:text-lexara-darkNavy
```

### **5. Data Display Components**

**User Card Pattern:**

```css
Container: p-6 flex items-center justify-between
Avatar: w-10 h-10 bg-lexara-primary rounded-full (with initials)
Layout: Avatar + Info + Actions in horizontal layout
```

**Status Badge Pattern:**

```css
Base: inline-flex items-center px-2 py-1 text-xs font-medium rounded-full

Variants:
- Admin role: bg-blue-100 text-blue-800
- User role: bg-gray-100 text-gray-800
- Active status: bg-green-100 text-green-800
- Inactive status: bg-yellow-100 text-yellow-800
```

**Info Card Pattern:**

```css
Container: bg-white rounded-xl shadow-sm
Header: p-6 border-b border-gray-200
Content: p-6
```

### **6. Loading & State Components**

**Loading Spinner Pattern:**

```css
Classes: w-8 h-8 border-3 border-lexara-primary border-t-transparent rounded-full animate-spin

Usage: Center in container with descriptive text
Text: "Loading..." or specific action description
```

**Empty State Pattern:**

```css
Container: p-8 text-center
Message: text-lexara-gray with helpful guidance
Optional: Icon or illustration above text
```

**Error State Pattern:**

```css
Icon: w-12 h-12 bg-lexara-error/10 rounded-full with error icon
Message: text-lexara-secondary for title, text-lexara-gray for description
Action: Retry button following primary button pattern
```

## 📱 Responsive Patterns

### **Mobile Navigation**

```css
/* Desktop: Horizontal nav links */
.hidden.md: flex.items-center.space-x-8
  /* Mobile: Hamburger menu (to be implemented) */ Collapsible menu pattern
  needed for mobile;
```

### **Mobile Forms**

```css
/* Full-width inputs on mobile */
w-full (already implemented)

/* Stacked layouts instead of grid on small screens */
grid-cols-1 md:grid-cols-2 (already implemented)
```

### **Mobile Modals**

```css
/* Full-screen on mobile, centered on desktop */
Current: max-w-md w-full mx-auto
Improvement needed: Full-screen mobile modal pattern
```

## 🎯 Design Patterns in Use

### **Progressive Disclosure**

- **Basic information first** - Complex actions behind modals
- **Role-based visibility** - Admin features hidden from regular users
- **Expandable sections** - Additional details on demand

### **Consistent Interactions**

- **Modal-based workflows** for complex actions (add/edit/delete)
- **Confirmation dialogs** for destructive actions
- **Immediate feedback** for user actions
- **Loading states** during API operations

### **Error Prevention**

- **Form validation** with immediate feedback
- **Required field indicators** with asterisks
- **Clear button states** (enabled/disabled/loading)
- **Confirmation steps** for irreversible actions

## 🚧 Areas Needing Design Attention

### **1. Mobile Experience Gaps**

- **Navigation menu** needs mobile-first redesign
- **Modal patterns** need full-screen mobile versions
- **Touch targets** need size optimization
- **Form layouts** need mobile-specific improvements

### **2. Visual Hierarchy Improvements**

- **Page headers** need more visual weight and better spacing
- **Section dividers** need clearer visual separation
- **Information density** needs optimization for scanning

### **3. Enhanced Feedback Systems**

- **Toast notifications** for non-blocking feedback
- **Progress indicators** for multi-step processes
- **Success animations** for completed actions
- **Better error messaging** with recovery suggestions

### **4. Accessibility Enhancements**

- **Focus indicators** need better visibility
- **Color contrast** needs verification across all components
- **Screen reader support** needs implementation
- **Keyboard navigation** needs complete coverage

## 🎨 Design System Opportunities

### **Component Expansion Needed:**

- **Toast/Notification system**
- **Breadcrumb navigation**
- **Data tables** with sorting/filtering
- **Dashboard widgets** and cards
- **File upload components**
- **Date/time pickers**

### **Animation & Micro-interactions:**

- **Page transitions** for smoother navigation
- **Button hover effects** beyond color changes
- **Loading animations** more engaging than spinners
- **Success confirmation** animations

### **Advanced Layout Patterns:**

- **Sidebar navigation** for desktop dashboard
- **Multi-column layouts** for content organization
- **Responsive grid systems** for dashboard widgets
- **Sticky headers** for long page navigation

---

_This component inventory provides the foundation for design system evolution. Each component should be refined for consistency, accessibility, and mobile optimization while maintaining the professional, trustworthy aesthetic appropriate for legal services._
