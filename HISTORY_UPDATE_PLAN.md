# History Portion Update Plan

## 1. Database Updates
- [x] **Indexes:** Added `idx_sessions_started_at` to the `sessions` table to optimize date-range queries.
- [x] **Indexes:** Added `idx_sessions_user_id` to the `sessions` table to optimize per-user history lookups.
- [ ] **Data Integrity:** Consider adding a constraint to ensure `started_at` is never null (though it's currently handled by the API).

## 2. API Enhancements
- [x] **Range Queries:** Implemented `getSessionsByDateRange(startDate, endDate)` in `api.js` to fetch only relevant sessions for the calendar view.
- [x] **Flexible Creation:** Updated `createSession` to accept an optional `date` parameter, allowing users to log past workouts.

## 3. Frontend Improvements
- [x] **Calendar View:** Replaced the simple list with a full-month calendar in `history.js`.
- [x] **Interaction:** Added day selection to view workouts for a specific day.
- [x] **Add Workout:** Integrated a "Log Workout" flow directly from the calendar, supporting both templates and empty workouts.
- [x] **Today Page:** Updated `today.js` to allow starting any workout (from template) even on rest days.

## 4. Optimization Strategies
- [x] **Selective Loading:** Only load sessions for the visible month in the calendar.
- [ ] **State Caching:** Implement client-side caching for month data to prevent re-fetching when navigating back and forth between months.
- [ ] **Lighter Calendar Query:** If the number of sessions grows very large, create a dedicated RPC or light query that only returns the days with workouts (booleans) for the calendar dots, fetching details only for the selected day.
- [ ] **Lazy Detail Loading:** Continue using the pattern of fetching session details (exercises/sets) only when a session is expanded or selected.

## 5. Future Actions
- [ ] Implement "Duplicate Workout" feature in history to quickly re-log a previous session.
- [ ] Add "Month Summary" stats (total volume, number of workouts, etc.) at the bottom of the calendar.
