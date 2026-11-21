# Contributing to live-listener-counter

Keep `live-listener-counter` zero-dependency and fast.

## Running Tests

```bash
npm test
```

## Design Rules

- Use built-in Node 20+ modules (`node:crypto`, `node:http`, `node:test`) so consumers never pull extra transitive dependencies.
- Clamp time deltas on every heartbeat so client-supplied clocks cannot inflate listen streaks.
