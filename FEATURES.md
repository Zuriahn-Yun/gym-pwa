# Gym PWA Features & Roadmap

This file serves as a source of truth for AI agents and developers regarding the current state and planned features of the Gym PWA.

## Current Features
- **Authentication:** Google OAuth via InsForge.
- **Workout Tracking:**
  - Create workouts from templates or empty sessions.
  - Track sets, reps, and weight for strength exercises.
  - Automatic loading of exercises from templates.
- **History:**
  - Full-month calendar view of past workouts.
  - Detail view of individual sessions.
  - Double-tap a day on the calendar to quickly add a workout.
- **Templates:**
  - Create and manage workout templates.
  - Add/remove/reorder exercises within templates.
- **Settings:**
  - Dedicated settings page with account management.
  - "Connect to Strava" button for activity syncing.
  - Centralized "Sign Out" button.
- **Exercise Database:**
  - Searchable list of exercises.
  - Support for different exercise types (Strength, Running, Swimming).

## Planned Features (Priority)
- [x] **Delete Workouts:** Ability to remove sessions from the history page.
- [ ] **Expanded Activities:**
  - [x] Basic support for Running/Swimming (Schema level).
  - [ ] Enhanced UI for cardio/endurance activities (Pace, Laps, etc.).
- [ ] **Integrations:**
  - [ ] Strava API integration for syncing running/swimming data.
- [ ] **Data Optimization:**
  - [ ] Client-side caching for calendar data.
  - [ ] Lighter queries for month-view dots.

## Technical Standards
- **Backend:** InsForge (PostgreSQL + Auth + Hosting).
- **Frontend:** Vanilla JS (ES Modules) + Vanilla CSS.
- **CI/CD:** GitHub Actions with Puppeteer smoke tests.
- **Quality Control:** No deployments allowed if smoke tests detect `ReferenceError` or uncaught exceptions.
