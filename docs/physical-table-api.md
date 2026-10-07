# Physical table link

The scenario at `dist/scenario/` supports a two-way WebSocket connection. No endpoint or credentials are embedded, no connection is attempted until configured, and this link is independent of the existing Unity selection API.

## Coordinate frame

- `extentId`: `la-higuera-20261007-bounds2`
- Default `tableId`: `la-higuera`
- `u`: 0 at the west edge, 1 at the east edge.
- `v`: 0 at the north/rear edge, 1 at the south/front edge.
- The latest user-supplied GeoJSON replaces the earlier DMS / ZIP extent. NW: (-71.480437, -29.160639), NE: (-70.993245, -29.160639), SE: (-70.993245, -29.585199), SW: (-71.480437, -29.585199), in longitude / latitude order.
- Normalized coordinates linearly map longitude and latitude within this rectangle, preserving every boundary edge exactly. WGS84 / UTM zone 19S (`EPSG:32719`) is used to calculate horizontal dimensions.
- Width approximately 47.308 km; depth 47.068 km. Physical aspect ratio 1.005. Choose the actual board dimensions later, using this ratio, and calibrate its tracked corners to `(0,0)`, `(1,0)`, `(1,1)`, `(0,1)`.
- Vertical exaggeration is 2.8× in the display only. API latitude/longitude and route distances are not exaggerated.

The amber object is an oversized interaction handle. Its projected footprint is the illustrative 185 ha area at the correct horizontal scale. Protection cylinders are attached handles, not geographic coverage radii.

## Connect when the endpoint is ready

Supply runtime configuration before the `table.mjs` module starts:

```js
window.MineScopeScenarioConfig = {
  endpoint: 'wss://YOUR_SERVER/table',
  tableId: 'la-higuera',
  protocols: []
};
```

Or call the public interface after the terrain is ready:

```js
window.MineScopeTable.connect('wss://YOUR_SERVER/table');
window.MineScopeTable.disconnect();
```

For local development only, `?tableSocket=ws%3A%2F%2F127.0.0.1%3A4180%2Ftable` also works. The parameter is removed from the address bar. Configuration is kept in memory, not local storage. Use `wss://` from the HTTPS production page. Authentication will be agreed with the endpoint provider; a secure session cookie or an agreed WebSocket subprotocol can be used. Do not embed credentials in source or query strings.

## Messages

Every message includes `version: 1`, `type`, `tableId`, `extentId`, a stable `origin` per client connection session, and an increasing integer `sequence` per origin. An outgoing browser message also has an ISO `timestamp`. The origin is a fresh UUID for each loaded browser session; a physical client should use the same convention.

On connection the browser sends `table.hello`, including `frame` (corners, CRS, dimensions, axes) and `initialState`, followed by `table.snapshot.request`. The server should verify the extent and return its authoritative `table.snapshot`. `initialState` is a bootstrap hint for an empty table session, never a command to overwrite an existing session.

Browser changes send a complete `table.state`:

```json
{
  "version": 1,
  "type": "table.state",
  "tableId": "la-higuera",
  "extentId": "la-higuera-20261007-bounds2",
  "origin": "browser-session-uuid",
  "sequence": 12,
  "timestamp": "2026-10-07T18:00:00.000Z",
  "position": {"u": 0.6, "v": 0.7},
  "protections": ["water", "habitat"],
  "phase": "placed"
}
```

The actual browser payload also includes `position.lat` and `position.lon`, plus derived `indicators`, `fund` (values in millions of US dollars), `viable` and `geographyComplete`. These are demonstration outputs. Consumers must check `geographyComplete`; missing source layers are not evidence of safety or no environmental impact. Incoming computed scores are ignored; the app recomputes them from position and protection selections.

Physical trackers can send `table.patch` with only the fields they change:

```json
{
  "version": 1,
  "type": "table.patch",
  "tableId": "la-higuera",
  "extentId": "la-higuera-20261007-bounds2",
  "origin": "physical-session-uuid",
  "sequence": 24,
  "position": {"u": 0.45, "v": 0.55},
  "phase": "lifted"
}
```

An incoming position can instead contain `lat` / `lon`. If both representations are supplied, they must agree. Positions outside the frame are rejected, with a millimetre-scale tolerance for projection roundoff at an exact corner. Fields omitted from a patch preserve their current values. A complete `table.state` or `table.snapshot` must contain position and the protection list.

Protection IDs: `water`, `habitat`, `dust`, `monitor`, `fund` (closure restoration). Array order is funding priority; an empty array removes all allocations. Only selections are exchanged, because funded fractions depend on the current site. Phase: `lifted`, `placed`, or `cancelled`. Position is the ground anchor and stays fixed while a stationary object is lifted.

## Timing, conflicts and recovery

Continuous local moves are coalesced at at most 20 Hz, while rendering and local calculations continue immediately. Lift, drop, keyboard moves, Reset, comparison placement and protection changes publish immediately. A slow socket keeps only the newest unsent state. Disconnected local changes also collapse into one newest state.

The server should merge patches into its session state and serialize accepted updates in arrival order. Preserve the originating client's `origin` and `sequence` when broadcasting accepted edits. The browser ignores its own echoes and repeated / older sequence numbers. Server snapshots use a server session origin and increasing sequence. After a server restart, use a fresh origin so its sequence can restart.

Accepted incoming server state is authoritative: a position or phase command ends an active local drag at its current anchor and cancels pending unsent local motion, then updates the piece, protections, funding and KPIs without moving the camera. A protections-only patch preserves the current position and lift phase. Incoming updates are never republished, preventing feedback loops. A newly edited local state can be sent after that remote update.

Reconnect uses bounded exponential backoff with jitter (approximately 0.5–15 seconds), sends a fresh hello and requests a snapshot. If local edits happened while offline, the newest is sent after the request; the server determines the accepted ordering. Enforce authentication, table ownership, rate limits, idle heartbeat handling and durable state on the production server. The small relay below is solely a localhost integration harness, with in-memory state and no persistence or authentication.

## Local integration harness

Node 24 is sufficient; no package install is needed:

```sh
node tools/table-relay.mjs
```

Open the local scenario with the `tableSocket` parameter shown above. A “Table linked” status appears. Simulate a physical placement and optional protection changes:

```sh
node tools/table-simulator.mjs 0.45 0.55 water,habitat,monitor
```

The relay listens only on `127.0.0.1:4180`, logs accepted changes, and reports its current state at `http://127.0.0.1:4180/`. It accepts only local browser origins. It is outside `dist/` and is not deployed by GitHub Pages.

Validation: `node --test tests/scenario-*.test.mjs`. The relay test opens real WebSocket connections; it needs permission to bind a localhost port. Other tests use synthetic fixtures and fake sockets, covering round trips, footprint scale, source decoding, exclusions, funding, echo prevention, throttling, invalid messages and reconnect recovery.

The scenario header always shows the WebSocket status: Not configured, Connecting, Connected, Reconnecting, or Unavailable. No endpoint means no connection attempts. The legacy Unity notice appears on this page only when a Unity key is explicitly supplied; the project map keeps its existing Unity status.
