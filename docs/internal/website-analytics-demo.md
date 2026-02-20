# Website Analytics Demo Mode

To keep the Website Insights dashboard looking alive during development:

- Set `NEXT_PUBLIC_ANALYTICS_DEMO=1` in your `.env.local`, **or**
- Append `?demo=1` to `/dashboard/analytics/website`.

Demo mode only takes effect in development (`NODE_ENV=development`).
