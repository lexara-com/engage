# Engage Legal AI Chat Interface

A professional, production-ready Astro-based UI for the Engage legal AI chat system. This interface provides a clean, trustworthy chat experience designed specifically for legal client intake.

## 🚀 Features

### Core Functionality
- **Real-time streaming chat** with the Engage backend API
- **Server-side rendering (SSR)** for optimal performance and SEO
- **Session persistence** with local storage backup
- **Responsive design** optimized for mobile and desktop
- **Professional legal disclaimers** and compliance features

### Design & UX
- **Lexara.com-inspired design** with professional color palette
- **Figtree/Inter typography** for clean, readable text
- **Mobile-first responsive design** with touch-friendly interfaces
- **Accessibility features** with proper ARIA labels and keyboard navigation
- **Professional animations** with subtle transitions

### Technical Architecture
- **Astro SSR** with Node.js adapter for server-side rendering
- **Tailwind CSS** for responsive, utility-first styling
- **TypeScript** for type safety and better development experience
- **Streaming API integration** with the Engage backend
- **Progressive Web App (PWA)** capabilities for mobile installation

## 📁 Project Structure

```
src/ui/
├── components/
│   ├── ChatWindow.astro      # Main chat interface component
│   ├── MessageBubble.astro   # Individual message display
│   ├── InputArea.astro       # Message input with validation
│   └── LegalDisclaimer.astro # Legal notices and disclaimers
├── layouts/
│   └── BaseLayout.astro      # Base HTML layout with fonts & meta
├── pages/
│   ├── index.astro           # Main chat page
│   └── api/
│       ├── chat.ts           # Chat message API proxy
│       └── chat/
│           ├── session.ts    # Session creation API
│           └── session/[id].ts # Session retrieval API
├── styles/
│   └── global.css            # Tailwind CSS with custom components
├── types/
│   └── chat.ts               # TypeScript type definitions
└── utils/
    └── chat.ts               # Chat utilities and API client
```

## 🎨 Design System

### Color Palette
- **Primary Navy**: `rgb(30, 43, 59)` - Headers, buttons, branding
- **Soft Beige**: `rgb(243, 240, 237)` - Background, neutral areas
- **Blue-Gray**: `rgb(198, 216, 219)` - Accents, borders, secondary elements
- **Slate Blue**: `rgb(59, 87, 108)` - Hover states, subtle emphasis

### Typography
- **Primary Font**: Figtree (Google Fonts)
- **Secondary Font**: Inter (Google Fonts)
- **Fallback**: System UI sans-serif stack

### Components
- **Chat bubbles** with role-based styling (user vs assistant)
- **Professional buttons** with hover and focus states
- **Form inputs** with validation and accessibility
- **Loading states** with animated spinners
- **Legal disclaimers** with appropriate visual hierarchy

## 🔧 Configuration

### Environment Variables (optional)
Create a `.env` file based on `.env.example`:

```bash
# Engage API Configuration
ENGAGE_API_BASE=https://engage-legal-ai.cloudswift.workers.dev

# Environment
NODE_ENV=development
PORT=4321

# Optional: Custom branding
FIRM_NAME="Your Law Firm"
FIRM_LOGO_URL=""
FIRM_THEME_COLOR="rgb(30, 43, 59)"
```

### Astro Configuration
- **SSR enabled** with Node.js adapter
- **Tailwind CSS integration** for styling
- **TypeScript support** with strict type checking

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev:ui
```

The UI will be available at `http://localhost:4321`

### 3. Build for Production
```bash
npm run build:ui
```

### 4. Preview Production Build
```bash
npm run preview:ui
```

## 📱 Mobile Features

### Responsive Design
- **Adaptive layouts** that work from 320px to 2560px wide
- **Touch-friendly buttons** with minimum 44px touch targets
- **Mobile-optimized typography** with appropriate font sizes
- **Viewport optimizations** to prevent zoom on input focus

### PWA Support
- **Web app manifest** for installation on mobile devices
- **Service worker ready** (can be enhanced for offline support)
- **App-like experience** with standalone display mode

## 🔒 Legal & Compliance

### Professional Disclaimers
- **Modal disclaimer** on first visit requiring user acknowledgment
- **Inline disclaimers** in chat input areas
- **Footer disclaimers** on larger screens
- **No attorney-client privilege** warnings

### Security Features
- **HTTPS-only** communication with backend
- **Input validation** and sanitization
- **XSS protection** with proper content handling
- **CORS configuration** for API requests

## 🔌 API Integration

### Backend Communication
The UI communicates with the Engage backend through:

1. **Astro API routes** (`/api/chat/*`) that proxy requests
2. **Streaming responses** for real-time chat experience
3. **Session management** with persistent storage
4. **Error handling** with user-friendly messages

### API Endpoints
- `POST /api/chat` - Send messages and receive streaming responses
- `POST /api/chat/session` - Create new chat sessions
- `GET /api/chat/session/:id` - Retrieve existing sessions

## 🎯 Key Components

### ChatWindow.astro
- Main chat interface with header, messages, and input
- Real-time message streaming with typing indicators
- Session management and state persistence
- Connection status monitoring

### MessageBubble.astro
- Individual message display with role-based styling
- Timestamp formatting and metadata display
- Streaming content updates with smooth animations
- Error state handling

### InputArea.astro
- Auto-resizing textarea with character counting
- Send button with loading states
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Mobile-optimized input handling

### LegalDisclaimer.astro
- Multiple variants (modal, inline, footer)
- User acknowledgment tracking
- Professional legal language
- Accessibility compliance

## 🔄 Session Management

### Client-Side Persistence
- **Local storage** backup for session continuity
- **URL-based session IDs** for shareable links
- **Automatic recovery** after interruptions
- **Session state synchronization** with backend

### Server-Side Integration
- **Session creation** through Engage backend
- **Message history** retrieval and display
- **Real-time updates** with streaming responses
- **Error recovery** and reconnection logic

## 🎨 Customization

### Branding
The interface can be customized for different law firms:

1. **Color scheme** via Tailwind CSS variables
2. **Typography** by updating font imports
3. **Logo and branding** in header components
4. **Legal disclaimers** with firm-specific language

### Layout Options
- **Full-screen chat** for embedded use
- **Responsive containers** for various screen sizes
- **Header customization** with firm branding
- **Footer options** with additional legal information

## 📊 Performance

### Optimization Features
- **Server-side rendering** for fast initial loads
- **Optimized fonts** with preconnect hints
- **Efficient bundling** with Astro's built-in optimization
- **Responsive images** and lazy loading (ready for enhancement)

### Bundle Size
- **Minimal JavaScript** for core functionality
- **Treeshaking** to eliminate unused code
- **CSS optimization** with Tailwind's purge system
- **Modern browser targets** for optimal performance

## 🧪 Testing & Development

### Development Tools
- **TypeScript** for compile-time error checking
- **ESLint** for code quality (configured in parent project)
- **Hot module replacement** during development
- **Source maps** for debugging

### Browser Support
- **Modern browsers** (Chrome 90+, Firefox 88+, Safari 14+)
- **Mobile browsers** with touch and gesture support
- **Progressive enhancement** for older browsers
- **Accessibility compliance** with WCAG 2.1 guidelines

## 🚀 Deployment

### Production Deployment
The UI can be deployed as:

1. **Standalone Node.js app** using the included adapter
2. **Static site** with pre-rendered pages (modify config)
3. **Cloudflare Pages** integration (future enhancement)
4. **Docker container** for scalable deployments

### Environment Configuration
- **API endpoint configuration** via environment variables
- **CORS settings** for cross-origin requests
- **Security headers** and HTTPS enforcement
- **Monitoring and logging** integration points

---

**Built with ❤️ using Astro, TypeScript, and Tailwind CSS**

*This interface provides a professional, accessible, and mobile-optimized experience for legal client intake powered by the Engage AI system.*