# Personal Finance Tracker

[![CI](https://github.com/itsluminous/personal-finance-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/itsluminous/personal-finance-tracker/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-202%20passing-brightgreen)](https://github.com/itsluminous/personal-finance-tracker)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com/)

A responsive web application for tracking and visualizing financial assets across multiple profiles with role-based access control.

## Features

- 🔐 **Secure Authentication** - Supabase Auth with automatic admin assignment for first user
- 👥 **Multi-User Access Control** - Admin approval workflow with read-only, edit, and admin roles
- 📊 **Profile Management** - Track finances for multiple family members independently
- 💰 **Financial Data Entry** - Comprehensive asset tracking across risk categories
- 📈 **Visual Analytics** - Interactive charts showing risk distribution and asset trends
- 🎯 **Combined Portfolio View** - Aggregate view across all profiles
- 📱 **Responsive Design** - Optimized for mobile, tablet, and desktop
- 🔒 **Row Level Security** - Database-level access control via Supabase RLS

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Supabase account

### Installation

1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Set up the database:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the SQL script from `database-setup.sql`

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

```bash
# Development
npm run dev          # Start development server

# Testing
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with UI

# Linting
npm run lint         # Run ESLint

# Building
npm run build        # Build for production
npm start            # Start production server
```

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI (shadcn/ui)
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Charts**: Recharts
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest, React Testing Library, fast-check (property-based testing)
- **Hosting**: Vercel

## Testing

The application has comprehensive test coverage with **202 passing tests**:

- ✅ Unit tests for all core functionality
- ✅ Integration tests for component interactions  
- ✅ Property-based tests for universal correctness properties
- ✅ Component tests for UI behavior

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Test Coverage

- **26 test files** covering all features
- **15 property-based tests** validating correctness properties
- All authentication, authorization, and data management flows tested
- Responsive design and error handling verified

## Deployment

### Vercel Deployment (Recommended)

#### Option 1: Via Vercel Dashboard

1. Push your code to GitHub, GitLab, or Bitbucket
2. Log in to [Vercel](https://vercel.com)
3. Click "Add New Project"
4. Import your repository
5. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click "Deploy"

#### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Pre-Deployment Checklist

Before deploying, ensure:

```bash
# All tests pass
npm test

# Linting passes
npm run lint

# Build succeeds
npm run build
```

### Post-Deployment Verification

After deployment, verify:

1. ✅ Authentication works (sign up and log in)
2. ✅ First user gets admin role automatically
3. ✅ Subsequent users require admin approval
4. ✅ Profile creation and management works
5. ✅ Financial data entry and calculations work
6. ✅ Analytics charts display correctly
7. ✅ Responsive design works on mobile, tablet, and desktop
8. ✅ RLS policies enforce proper access control

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) automatically:
- Runs on push to `main` and `develop` branches
- Runs on pull requests
- Executes linting checks
- Runs all 202 tests
- Builds the application

### Setting up GitHub Secrets

Add these secrets to your GitHub repository for CI to work:

1. Go to repository Settings → Secrets and variables → Actions
2. Add secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Project Structure

```
personal-finance-tracker/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── admin/             # Admin panel
│   ├── analytics/         # Analytics page
│   └── profiles/          # Profile management
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── ...               # Feature components
├── lib/                   # Utility functions and types
├── __tests__/            # Test files (202 tests)
├── database-setup.sql    # Database schema and RLS policies
└── .github/workflows/    # CI/CD configuration
```

## Key Features

### Authentication & Authorization
- First user automatically becomes admin
- Subsequent users require admin approval
- Three permission levels: read-only, edit, admin
- Row Level Security enforces access at database level

### Profile Management
- Create multiple profiles for family members
- Profiles can exist independently
- Admin can link existing profiles to users
- Cascade deletion of profile data

### Financial Data Entry
- Track 18 different asset categories:
  - **High/Medium Risk**: Direct Equity, ESOPs, Equity PMS, ULIP, Real Estate, Real Estate Funds, Private Equity, Equity Mutual Funds, Structured Products - Equity
  - **Low Risk**: Bank Balance, Debt Mutual Funds, Endowment Plans, Fixed Deposits, NPS, EPF, PPF, Structured Products - Debt, Gold ETFs/Funds
- Automatic calculation of totals
- Decimal precision preservation (2 decimal places)
- Pre-fill with most recent data
- Historical record keeping

### Analytics & Visualization
- Risk distribution pie charts
- Asset trend line graphs
- Time period filters (30 days, 3 months, 1 year)
- Combined portfolio view across all profiles
- Responsive chart rendering

### Responsive Design
- Mobile-first approach (< 640px)
- Tablet optimization (640px - 1024px)
- Desktop optimization (> 1024px)
- Smooth transitions and animations
- Touch-friendly interfaces

## Requirements Status

All 12 requirements from the specification are **fully implemented and tested**:

| Requirement | Status | Tests |
|-------------|--------|-------|
| 1. User Authentication | ✅ | 7 tests + 3 property tests |
| 2. Multi-User Access Control | ✅ | 11 tests + 4 property tests |
| 3. Profile Management | ✅ | 12 tests + 3 property tests |
| 4. Financial Data Entry | ✅ | 15 tests + 3 property tests |
| 5. High/Medium Risk Assets | ✅ | Covered in financial entry tests |
| 6. Low Risk Assets | ✅ | Covered in financial entry tests |
| 7. Visual Analytics | ✅ | 22 tests + 1 property test |
| 8. Combined Portfolio | ✅ | Covered in analytics + 1 property test |
| 9. Responsive Design | ✅ | 12 tests |
| 10. Database & RLS | ✅ | Covered in integration tests + 3 property tests |
| 11. CRUD Operations | ✅ | Covered in financial entry tests |
| 12. Technology Stack | ✅ | Full implementation |

**Total: 202 tests passing** ✅

## Troubleshooting

### Build Issues

If the build fails:
1. Ensure all environment variables are set correctly
2. Check that Node.js version is 20.x or higher
3. Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

### Database Issues

If database operations fail:
1. Verify Supabase credentials in `.env.local`
2. Ensure `database-setup.sql` has been run
3. Check RLS policies are enabled in Supabase dashboard

### Test Failures

If tests fail:
1. Ensure all dependencies are installed: `npm install`
2. Check that test environment is properly configured
3. Run tests individually to isolate issues: `npm test -- <test-file>`

## License

This project is private and proprietary.

## Support

For detailed information, refer to:
- [Specification](./.kiro/specs/personal-finance-tracker/) - Full requirements, design, and implementation plan
- GitHub Issues - Report bugs or request features
- Supabase Documentation - For database and auth issues
- Vercel Documentation - For deployment issues
