# AI Support Hub

A full-stack AI-powered customer support platform with intelligent chat agents, conversation management, and comprehensive analytics.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Security](#security)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Overview

AI Support Hub is a modern customer support platform that combines AI-powered chatbots with human agent capabilities. It provides:

- **AI-Powered Conversations**: Intelligent chatbot responses using various AI providers (OpenAI, Anthropic, etc.)
- **Multi-Tenant Architecture**: Isolated workspaces for different organizations
- **Real-time Chat**: WebSocket-based real-time messaging
- **Analytics Dashboard**: Comprehensive conversation and performance metrics
- **Team Collaboration**: Role-based access control and team management
- **Widget Integration**: Embeddable chat widget for websites
- **Subscription Management**: Stripe-powered billing and subscription handling

## Features

### Core Features
- 🤖 AI-powered chatbot with multiple provider support
- 💬 Real-time conversation management
- 👥 Team collaboration with role-based permissions
- 📊 Analytics and reporting dashboard
- 🎨 Customizable chat widget
- 🔒 Enterprise-grade security
- 💳 Subscription and billing management
- 📧 Email template system
- 🔌 API integrations (Stripe, WooCommerce, etc.)

### Admin Features
- Super admin dashboard
- Tenant management
- Rate limiting configuration
- Email campaign management
- Marketplace for extensions
- Observability and logging

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.9+)
- **Database**: MongoDB with Motor (async driver)
- **Authentication**: JWT-based authentication with bcrypt
- **AI Providers**: OpenAI, Anthropic, Google AI
- **Payments**: Stripe
- **Email**: SendGrid
- **Storage**: Configurable (Local/Cloud)

### Frontend
- **Framework**: React 19
- **Routing**: React Router v6
- **UI Components**: shadcn/ui + Tailwind CSS
- **State Management**: React Context API
- **Build Tool**: Create React App with CRACO

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python**: 3.9 or higher
- **Node.js**: 16.x or higher
- **MongoDB**: 4.4 or higher
- **Yarn**: 1.22.22 or higher (recommended) or npm

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd KaizenAgents-AI
```

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On Unix or MacOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install
# or
npm install
```

## Configuration

### Backend Configuration

1. Copy the example environment file:
```bash
cd backend
cp .env.example .env
```

2. Edit `.env` and configure the following required variables:

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=ai_support_hub

# Security (REQUIRED - must be set)
JWT_SECRET=your-secure-random-string-min-32-characters
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Application
FRONTEND_URL=http://localhost:3000
SUPER_ADMIN_EMAIL=admin@yourdomain.com

# Email (optional)
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com

# AI Providers (optional)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Important Security Notes:**
- Never use default values for `JWT_SECRET` in production
- Never use `CORS_ORIGINS="*"` - always specify exact origins
- Keep `.env` file out of version control (already in `.gitignore`)

### Frontend Configuration

1. Copy the example environment file:
```bash
cd frontend
cp .env.example .env
```

2. Edit `.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

## Running the Application

### Development Mode

#### 1. Start MongoDB

```bash
# Using MongoDB service
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

#### 2. Start Backend Server

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

#### 3. Start Frontend Development Server

```bash
cd frontend
yarn start
# or
npm start
```

The application will be available at `http://localhost:3000`

### Production Mode

See [DEPLOYMENT_READINESS_REPORT.md](DEPLOYMENT_READINESS_REPORT.md) for production deployment guidelines.

## Project Structure

```
KaizenAgents-AI/
├── backend/
│   ├── middleware/          # Auth, database, rate limiting, etc.
│   ├── models/             # Pydantic models
│   ├── routes/             # API route handlers (modular)
│   ├── services/           # Business logic (AI, email, etc.)
│   ├── utils/              # Helper functions
│   ├── uploads/            # File uploads directory
│   ├── server.py           # Main FastAPI application
│   ├── .env                # Environment variables (not in git)
│   ├── .env.example        # Environment template
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── shared/     # Shared/reusable components
│   │   │   └── ui/         # shadcn/ui components
│   │   ├── config/         # Configuration constants
│   │   ├── context/        # React context providers
│   │   ├── pages/          # Page components
│   │   ├── App.js          # Main app component
│   │   └── index.js        # Entry point
│   ├── .env                # Environment variables (not in git)
│   ├── .env.example        # Environment template
│   └── package.json        # Node dependencies
├── tests/                  # Backend test files
├── test_reports/          # Test results
└── README.md              # This file
```

## Security

This application implements several security best practices:

### Implemented Security Features
- ✅ JWT-based authentication with required secret
- ✅ Password hashing with bcrypt
- ✅ Strong password policy (12+ chars, complexity requirements)
- ✅ CORS protection (no wildcard allowed)
- ✅ Rate limiting (strict limits on auth endpoints)
- ✅ Security headers (CSP, X-Frame-Options, etc.)
- ✅ Webhook signature verification (Stripe)
- ✅ Input validation with Pydantic
- ✅ Error boundaries (React)

### Security Checklist for Production
- [ ] Rotate JWT_SECRET regularly
- [ ] Enable HTTPS (Strict-Transport-Security header)
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and alerting
- [ ] Enable API key encryption at rest
- [ ] Implement 2FA/MFA for admin users
- [ ] Regular security audits
- [ ] Dependency vulnerability scanning

## Development

### Code Quality Standards

#### Frontend
- Use centralized API constants from `frontend/src/config/constants.js`
- Use shared components from `frontend/src/components/shared/`
- Implement proper error handling with ErrorBoundary
- Add proper ARIA labels for accessibility
- Use React.memo/useMemo for performance optimization

#### Backend
- Use password validation from `backend/utils/password_validator.py`
- Follow modular route structure in `backend/routes/`
- Use middleware for cross-cutting concerns
- Add proper type hints and Pydantic models
- Use centralized logging utilities

### Adding New Features

1. **Backend API Endpoint**:
   - Create route in `backend/routes/`
   - Add Pydantic models in `backend/models/`
   - Update API documentation
   - Add rate limiting if needed

2. **Frontend Component**:
   - Create component in appropriate directory
   - Use constants from `config/constants.js`
   - Add error boundary if needed
   - Ensure accessibility (ARIA labels)

### Database Indexes

Recommended indexes for production:

```javascript
// Users
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ tenant_id: 1 })

// Conversations
db.conversations.createIndex({ tenant_id: 1, status: 1 })
db.conversations.createIndex({ created_at: -1 })

// Messages
db.messages.createIndex({ conversation_id: 1, created_at: 1 })
```

## Testing

### Backend Tests

```bash
cd tests
python backend_test.py
```

**Note**: Current tests are integration tests. Proper unit tests with pytest are recommended for production.

### Frontend Tests

Frontend testing setup is pending. Recommended stack:
- Jest for unit tests
- React Testing Library for component tests
- Cypress for E2E tests

## Deployment

See the following guides for deployment:
- [DEPLOYMENT_READINESS_REPORT.md](DEPLOYMENT_READINESS_REPORT.md) - Production checklist
- [PRODUCTION_URL_FIX.md](PRODUCTION_URL_FIX.md) - URL configuration
- [STRIPE_DEBUG_GUIDE.md](STRIPE_DEBUG_GUIDE.md) - Stripe integration

### Quick Deployment Checklist

1. [ ] Set all required environment variables
2. [ ] Use strong, unique JWT_SECRET
3. [ ] Configure specific CORS origins (no wildcards)
4. [ ] Set up MongoDB with proper indexes
5. [ ] Configure Stripe webhooks
6. [ ] Enable HTTPS
7. [ ] Set up error monitoring
8. [ ] Configure backup strategy
9. [ ] Test payment flows
10. [ ] Load testing

## Documentation

Additional documentation available:
- [PAGE_TEMPLATE_GUIDE.md](PAGE_TEMPLATE_GUIDE.md) - CMS page templates
- [WOOCOMMERCE_INTEGRATION_GUIDE.md](WOOCOMMERCE_INTEGRATION_GUIDE.md) - WooCommerce setup
- [WIDGET_EMBED_FIX.md](WIDGET_EMBED_FIX.md) - Widget embedding
- [WEBSOCKET_FIX.md](WEBSOCKET_FIX.md) - WebSocket configuration

## Contributing

### Git Workflow

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Create pull request
5. Code review
6. Merge to main

### Commit Guidelines

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused and atomic

## Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review closed issues for solutions

## License

[Specify your license here]

---

**Built with ❤️ using FastAPI and React**
