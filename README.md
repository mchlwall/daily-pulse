# Daily Pulse 🫀📟

A medical-monitor-themed dashboard that turns daily test suite results into a shareable visual "health check." Paste JSON from test report and get an at-a-glance shareable report.

## How it works

1. **Intake** - Paste your JSON test report into the intake form
2. **Report** - A vital-signs dashboard renders: pass rate, failures, flakes, per-suite breakdowns, failure clusters, and a pass-rate trend chart
3. **Share** - Hit "Copy" to capture the dashboard as a PNG to your clipboard

## JSON shape

Only supply what the automation actually knows. Everything else is calculated in `schema.js`, so the headline numbers always match the breakdown.

```json
{
  "date": "Apr 17",
  "suites": [
    { "name": "suite_name", "passed": 608, "total": 652 }
  ],
  "clusters": [
    { "type": "NEW", "name": "Test name", "count": 3, "error": "Error message", "actLink": "https://..." }
  ],
  "history": [
    { "label": "Apr 16", "passRate": 90.4 }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `date` | Yes | Display label for the run date |
| `suites` | Yes | Array of `{ name, passed, total }` |
| `clusters` | No | Failure groups. `type` is `NEW`, `REGRESSION`, `FLAKE`, or `ENV`; `count` = unique failing tests in the cluster (default 1); `error` and `actLink` optional |
| `history` | No | Pass rates for **previous** working days, oldest first. Today is appended automatically |

### Calculated automatically

| Value | Derived from |
|---|---|
| Pass rate | Sum of `passed` / sum of `total` across `suites` |
| Unique failures | Sum of cluster `count` |
| New failures | Sum of `count` where `type` is `NEW` |
| Flakes | Sum of `count` where `type` is `FLAKE` |
| Incident days | Any day in the trend (including today) with a pass rate below 80% |

Pasted JSON is validated (types, ranges, `http(s)` links) before rendering, and ```` ```json ```` fences are stripped automatically.

## Files

| File | Purpose |
|---|---|
| `schema.js` | Single source of truth: example data, validation, derived metrics |
| `index.html` | Intake form (has "Load example" and "Load incident example") |
| `prompt.html` | Builds the MCP prompt; its example output comes from `schema.js` |
| `pulse/report.html` | Dashboard |

## Tech stack

Static HTML + vanilla JS. No build step, no server. External deps loaded from CDN at runtime:
- [Chart.js 4.4.1](https://www.chartjs.org/) - trend chart
- [html2canvas 1.4.1](https://html2canvas.hertzen.com/) - screenshot-to-clipboard