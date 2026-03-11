## Debug TODOs

### "Thinking deeper" cue sometimes hangs

- **Problem**: After the “thinking deeper” cue, sometimes no response ever appears.
- **Suspicion**: Spinner/cue UI flow or the request itself is not completing.

#### Tasks

- [ ] **Debug**: after “thinking deeper” cue, response sometimes never appears (spinner/cue flow or request not completing)
- [ ] **Reproduce**: reproduce hang reliably (repeat-prompt path) and capture console + network logs
- [ ] **Fix**: fix robustly
  - keep spinner visible during fetch
  - ensure cue doesn’t block/duplicate spinners
  - add safe timeout + fallback message if API stalls

