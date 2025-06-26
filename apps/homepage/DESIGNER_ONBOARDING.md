# 📋 Lexara Project Overview

This document provides an overview of the Lexara platform, its current state, and the technical context for design work.

## 🏢 Platform Overview

Lexara consists of two main applications:

### 1. **Client Chat Interface**

- Public-facing chat system for potential clients
- Intake form collection and lead generation
- AI-powered initial consultation and triage

### 2. **Firm Management Portal**

- Private dashboard for law firm staff
- User management and permission controls
- Client data review and case management
- Analytics and reporting tools

## 📚 Available Documentation

The following documents provide detailed information about the platform:

1. **APPLICATION_OVERVIEW.md** - Detailed functionality and architecture
2. **USER_FLOWS.md** - Complete user journey documentation
3. **UI_COMPONENTS.md** - Current design patterns and components
4. **TESTING_GUIDE.md** - How to explore the live application
5. **DESIGN_REQUIREMENTS.md** - Technical constraints and requirements

## 🚀 Current Application Status

### ✅ **Completed & Live Features:**

- **Firm Registration System** - Multi-step signup with Auth0 integration
- **User Management** - Add, edit, remove users with role-based permissions
- **Authentication Flow** - Secure login/logout with enterprise RBAC
- **Settings Dashboard** - Firm information and user administration
- **Email Integration** - Automated user invitations via AWS SES
- **Responsive Foundation** - Basic mobile-friendly layouts

### 🔧 **In Development:**

- Client chat interface integration
- Advanced dashboard analytics
- Email delivery optimization

## 🌐 Live Application Access

### Development Environment:

- **URL:** https://dev-www.lexara.app
- **Status:** Fully functional for testing

_Login credentials are available separately_

## 🎨 Current Design Foundation

### **Technology Stack:**

- **Frontend:** Astro with Tailwind CSS
- **Styling:** Utility-first CSS with custom design tokens
- **Icons:** Heroicons and custom SVGs
- **Fonts:** Lora (headings), Open Sans (body)
- **Deployment:** Cloudflare Workers (serverless)

### **Current Color Palette:**

```css
--lexara-primary: #2563eb /* Primary blue */ --lexara-secondary: #1f2937
  /* Dark gray */ --lexara-gray: #6b7280 /* Medium gray */
  --lexara-light: #f3f4f6 /* Light gray */ --lexara-accent: #10b981
  /* Green accent */ --lexara-error: #ef4444 /* Error red */
  --lexara-success: #10b981 /* Success green */;
```

### **Current Design Patterns:**

- Clean, professional aesthetic
- Consistent spacing using Tailwind's scale
- Form-heavy interfaces with clear validation
- Modal-based interactions for complex actions
- Role-based UI showing/hiding elements

## 📱 Responsive Implementation

### **Current Breakpoints:**

- Mobile: `< 640px`
- Tablet: `640px - 1024px`
- Desktop: `> 1024px`

### **Current Mobile Patterns:**

- Collapsible navigation menus
- Stacked form layouts
- Touch-friendly button sizing
- Readable text scaling

## 🔧 Technical Support

### **Claude AI Interface:**

The Claude AI interface can provide information about:

- Current functionality and user flows
- Technical constraints or requirements
- Implementation feasibility
- Existing code patterns and components

### **Example Technical Queries:**

- "Show me the current user management interface"
- "What authentication flows are already implemented?"
- "What are the technical constraints for the mobile design?"
- "How does the permission system work?"
