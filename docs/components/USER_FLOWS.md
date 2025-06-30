# 🚀 Lexara User Flows Documentation

## 🎯 Primary User Types

### **1. Firm Administrator**

- **Role:** Law firm partner, office manager, or IT administrator
- **Goals:** Set up firm account, manage users, configure settings
- **Tech comfort:** Medium to high
- **Device usage:** Primarily desktop, some mobile

### **2. Firm User (Attorney/Staff)**

- **Role:** Lawyer, paralegal, administrative staff
- **Goals:** Access client information, manage cases, review communications
- **Tech comfort:** Low to medium
- **Device usage:** Mixed desktop and mobile

### **3. Prospective Client (Future)**

- **Role:** Individual seeking legal services
- **Goals:** Get legal advice, understand options, connect with firm
- **Tech comfort:** Variable
- **Device usage:** Primarily mobile

## 📋 Flow 1: Firm Registration & Onboarding

### **Entry Points:**

- Direct URL: `https://dev-www.lexara.app/firm/signup`
- Marketing site call-to-action
- Referral links
- Sales team follow-up

### **Complete Flow:**

```
Landing Page
    ↓
[Call to Action: "Get Started"]
    ↓
Firm Signup Form (/firm/signup)
│   ├── Firm Name (required)
│   ├── Admin First Name (required)
│   ├── Admin Last Name (required)
│   ├── Admin Email (required)
│   ├── Create Password (required)
│   └── [Submit: "Create Firm Account"]
    ↓
Auth0 Account Creation
    ↓
Redirect to Callback (/firm/callback)
    ↓
Authentication Processing
    ↓
First Login Success → Dashboard (/firm/dashboard)
    ↓
[Success State: User sees welcome message]
```

### **User Experience Notes:**

- **Single-page form** - All information collected at once
- **Real-time validation** - Immediate feedback on field errors
- **Clear progress indication** - User knows what to expect
- **Security messaging** - Password requirements clearly stated
- **Professional tone** - Builds confidence in legal services

### **Error Handling:**

- **Email already exists** → Clear message with login link
- **Weak password** → Specific requirements shown
- **Network errors** → Retry options with helpful messaging
- **Auth0 errors** → Fallback to support contact

### **Success Metrics:**

- Form completion rate
- Time to complete registration
- Email verification completion
- First login success rate

## 🔐 Flow 2: User Authentication

### **Login Flow:**

```
Login Page (/firm/login)
│   ├── Email Input
│   ├── Password Input
│   ├── [Remember Me] (optional)
│   ├── [Forgot Password] link
│   └── [Login Button]
    ↓
Auth0 Authentication
    ↓ (Success)
Callback Processing (/firm/callback)
    ↓
Permission Context Loading
    ↓
Dashboard Redirect (/firm/dashboard)
    ↓
[Success: User sees personalized dashboard]
```

### **Password Reset Flow:**

```
Login Page → [Forgot Password Link]
    ↓
Password Reset Request
│   ├── Email Input
│   └── [Send Reset Email]
    ↓
Email Sent Confirmation
    ↓
[User checks email]
    ↓
Password Reset Link (from email)
    ↓
New Password Form
│   ├── New Password Input
│   ├── Confirm Password Input
│   └── [Update Password]
    ↓
Password Updated Confirmation
    ↓
Auto-redirect to Login Page
    ↓
[User logs in with new password]
```

### **User Experience Considerations:**

- **Clear error messages** for failed login attempts
- **Account lockout protection** after multiple failures
- **Secure password reset** with time-limited tokens
- **Mobile-friendly forms** with appropriate input types
- **Remember me functionality** for convenience

## 👥 Flow 3: User Management (Admin Only)

### **View Users Flow:**

```
Dashboard (/firm/dashboard)
    ↓
Settings Navigation → [Settings Link]
    ↓
Settings Page (/firm/settings)
    ↓
User Management Section
│   ├── [User List Display]
│   ├── [Add User Button] (admin only)
│   ├── [Edit Buttons] (per user, admin only)
│   └── [Remove Buttons] (per user, admin only)
```

### **Add User Flow:**

```
Settings Page → [Add User Button]
    ↓
Add User Modal Opens
│   ├── Email Address (required)
│   ├── First Name (optional)
│   ├── Last Name (optional)
│   ├── Role Selection (User/Admin)
│   ├── [Cancel Button]
│   └── [Add User Button]
    ↓ (Submit)
API User Creation
    ↓
AWS SES Email Invitation Sent
    ↓
Success Modal Display
│   ├── "Invitation Sent Successfully!"
│   ├── Email delivery confirmation
│   ├── Instructions for new user
│   └── [Done Button]
    ↓
Modal Closes + User List Refreshes
    ↓
[New user appears in list with "Invited" status]
```

### **Edit User Flow:**

```
User List → [Edit Button]
    ↓
Edit User Modal Opens
│   ├── Email (readonly)
│   ├── First Name (editable)
│   ├── Last Name (editable)
│   ├── Role Selection (User/Admin)
│   ├── [Cancel Button]
│   └── [Save Changes Button]
    ↓ (Submit)
API User Update
    ↓
Success Confirmation
    ↓
Modal Closes + User List Refreshes
    ↓
[Updated user information displayed]
```

### **Remove User Flow:**

```
User List → [Remove Button]
    ↓
Remove User Modal Opens
│   ├── "What would you like to do with [user email]?"
│   ├── [Deactivate & Remove from Firm] (recommended)
│   │   └── "Block login and remove from firm"
│   ├── [Permanently Delete] (dangerous)
│   │   └── "⚠️ Cannot be undone"
│   └── [Cancel Button]
    ↓ (Select Action)
Confirmation Dialog
│   ├── "Are you sure?" message
│   ├── [Yes, Proceed]
│   └── [Cancel]
    ↓ (Confirm)
API User Removal
    ↓
"Refreshing user list..." indicator
    ↓
User List Refresh
    ↓
[User removed from list + Success message]
```

### **Permission Controls:**

- **Admin users only** see user management interface
- **Cannot remove self** - validation prevents self-deletion
- **Role change confirmations** for security-sensitive changes
- **Audit trail** for all user management actions

## 🏢 Flow 4: Firm Settings Management

### **Settings Access Flow:**

```
Dashboard (/firm/dashboard)
    ↓
Navigation → [Settings]
    ↓
Settings Page (/firm/settings)
│   ├── [Firm Information Section]
│   │   ├── Firm Name (readonly)
│   │   ├── Firm ID (readonly)
│   │   ├── Current Plan (readonly)
│   │   └── Status (readonly)
│   └── [User Management Section]
       └── (as described in Flow 3)
```

### **Future Settings Expansions:**

- **Billing & Subscription Management**
- **Integration Settings** (email, calendar, etc.)
- **Branding Customization**
- **Security Settings**
- **Notification Preferences**

## 📱 Flow 5: Mobile Experience

### **Mobile Navigation Pattern:**

```
Mobile Dashboard
│   ├── [Hamburger Menu] (top left)
│   ├── [User Avatar] (top right)
│   └── [Main Content Area]
    ↓ (Menu Tap)
Slide-out Navigation
│   ├── Dashboard
│   ├── Conversations (future)
│   ├── Settings
│   ├── Analytics (future)
│   └── [Sign Out]
```

### **Mobile User Management:**

- **Simplified user cards** optimized for touch
- **Full-screen modals** for add/edit actions
- **Swipe gestures** for quick actions (future enhancement)
- **Touch-friendly confirmation dialogs**

## 🚨 Error States & Edge Cases

### **Network Connectivity Issues:**

- **Offline indicators** when connection lost
- **Retry mechanisms** for failed API calls
- **Data persistence** for form inputs during network issues
- **Graceful degradation** when services unavailable

### **Permission Boundary Violations:**

- **Clear access denied messages** for unauthorized actions
- **Redirect to appropriate pages** based on user role
- **No sensitive information exposure** in error states
- **Contact support options** for permission issues

### **Data Loading States:**

- **Skeleton screens** for initial page loads
- **Progressive loading** for large datasets
- **Loading indicators** for user actions
- **Empty states** with helpful guidance

## 🎯 Success Metrics by Flow

### **Registration Flow:**

- **Conversion rate** from landing page to completed signup
- **Time to complete** registration process
- **Abandonment points** in the form
- **Email verification completion** rate

### **User Management Flow:**

- **Task completion rate** for adding users
- **Error rate** in user management actions
- **Time to complete** user administration tasks
- **Email delivery success** rate for invitations

### **General Navigation:**

- **Page load performance** across all flows
- **Mobile vs desktop** completion rates
- **User satisfaction** scores for key tasks
- **Support ticket volume** related to UX issues

---

_These user flows represent the current state of the application and serve as a foundation for design improvements. Each flow should be optimized for clarity, efficiency, and user satisfaction._
