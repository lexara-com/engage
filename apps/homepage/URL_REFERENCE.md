# 🔗 Lexara Application URL Reference

## 🌐 Live Application URLs

### **Main Application Domain**
**Base URL:** `https://dev-www.lexara.app`

### **Public Pages**
- **Landing Page:** `https://dev-www.lexara.app/`
- **Features Page:** `https://dev-www.lexara.app/features`
- **Pricing Page:** `https://dev-www.lexara.app/pricing`
- **Public Signup:** `https://dev-www.lexara.app/signup`

### **Firm Portal URLs**
- **Firm Signup:** `https://dev-www.lexara.app/firm/signup`
- **Firm Login:** `https://dev-www.lexara.app/firm/login`
- **Dashboard:** `https://dev-www.lexara.app/firm/dashboard`
- **Settings:** `https://dev-www.lexara.app/firm/settings`
- **Auth Callback:** `https://dev-www.lexara.app/firm/callback`

### **API Endpoints**

#### **User Management APIs**
- **User Permissions:** `https://dev-www.lexara.app/api/v1/user/permissions`
- **Legacy Permissions:** `https://dev-www.lexara.app/api/v1/user/permissions-legacy`

#### **Firm Management APIs**
- **Firm Registration:** `https://dev-www.lexara.app/api/v1/firm/register`
- **Firm Settings:** `https://dev-www.lexara.app/api/v1/firm/settings`
- **Firm Users:** `https://dev-www.lexara.app/api/v1/firm/users`
- **Grant Admin:** `https://dev-www.lexara.app/api/v1/firm/grant-admin`

#### **Debug/Testing APIs**
- **Auth Status:** `https://dev-www.lexara.app/api/v1/debug/auth-status`
- **Auth0 Test:** `https://dev-www.lexara.app/api/v1/debug/auth0-test`
- **User Check:** `https://dev-www.lexara.app/api/v1/debug/check-user`
- **List Users:** `https://dev-www.lexara.app/api/v1/debug/list-users`
- **Token Test:** `https://dev-www.lexara.app/api/v1/debug/token-test`

### **Future Features (Planned)**
- **Client Intake:** `https://dev-www.lexara.app/intake/[firmId]`
- **Conversations:** `https://dev-www.lexara.app/firm/conversations`
- **Password Reset:** `https://dev-www.lexara.app/forgot-password`

## 🎯 Key Testing URLs

### **For User Flow Testing:**
1. **Start Here:** `https://dev-www.lexara.app/firm/signup`
2. **Login:** `https://dev-www.lexara.app/firm/login`
3. **Main Dashboard:** `https://dev-www.lexara.app/firm/dashboard`
4. **User Management:** `https://dev-www.lexara.app/firm/settings`

### **For API Testing:**
1. **Check Configuration:** `https://dev-www.lexara.app/api/v1/debug/auth0-test`
2. **User Permissions:** `https://dev-www.lexara.app/api/v1/user/permissions`
3. **Firm Users List:** `https://dev-www.lexara.app/api/v1/firm/users`

## 🔧 Development URLs

### **GitHub Repository**
- **Main Repo:** `https://github.com/lexara-com/engage`
- **Design Branch:** `https://github.com/lexara-com/engage/tree/design/marti-ui-ux`
- **Documentation:** `https://github.com/lexara-com/engage/tree/design/marti-ui-ux/apps/homepage`

### **Pull Request Template**
When ready to create a pull request:
`https://github.com/lexara-com/engage/pull/new/design/marti-ui-ux`

## 📱 Mobile Testing URLs

All URLs above work on mobile, but pay special attention to:
- **Mobile Signup:** `https://dev-www.lexara.app/firm/signup` (form layout)
- **Mobile Dashboard:** `https://dev-www.lexara.app/firm/dashboard` (navigation)
- **Mobile Settings:** `https://dev-www.lexara.app/firm/settings` (user management)

## 🎨 Design Considerations

### **URL Structure Patterns:**
- Public pages: `/{page}` (simple, clean)
- Firm portal: `/firm/{page}` (clear separation)
- APIs: `/api/v1/{domain}/{action}` (RESTful structure)

### **Security Notes:**
- All firm portal pages require authentication
- API endpoints have proper authorization checks
- URLs are designed to be intuitive and memorable

### **SEO-Friendly URLs:**
- Clean, descriptive paths
- No unnecessary parameters
- Consistent naming conventions

---

_This reference provides all application URLs for comprehensive testing and design work._